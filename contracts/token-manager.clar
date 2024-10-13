;;
;; @title TokenManager
;; This contract is responsible for managing tokens, 
;; such as setting locking token balances, 
;; or setting flow limits, for interchain transfers.
(impl-trait .token-manager-trait.token-manager-trait)
(define-constant CONTRACT-ID (keccak256 (unwrap-panic (to-consensus-buff? "token-manager"))))
(define-constant CHAIN-NAME (keccak256 (unwrap-panic (to-consensus-buff? "Stacks"))))
(define-constant PREFIX_CANONICAL_TOKEN_SALT (keccak256 (unwrap-panic (to-consensus-buff? "canonical-token-salt"))))
(define-constant TOKEN-ADDRESS .sip-10-token-example)
(define-constant INTERCHAIN-TOKEN-ID (keccak256
    (concat
        (concat PREFIX_CANONICAL_TOKEN_SALT CHAIN-NAME)
        (unwrap-panic (to-consensus-buff? TOKEN-ADDRESS)))))

(define-constant INTERCHAIN-TOKEN-SERVICE .interchain-token-service)
(define-map roles principal {
    operator: bool,
    flow-limiter: bool,
})

;; Ideally should not be set only the ITS should control the contract
(map-set roles tx-sender {
    operator: true,
    flow-limiter: true,
})

;; Add operator and flow limiter role to the service. 
;; The operator can remove the flow limiter role if they so chose 
;; and the service has no way to use the operator role for now.
(map-set roles INTERCHAIN-TOKEN-SERVICE {
    operator: true,
    flow-limiter: true,
})

(define-data-var operator principal tx-sender)
(define-data-var flow-limiter principal tx-sender)

;; Checks that the sender is the interchain-token-service contract
(define-read-only (is-its-sender) 
    (is-eq tx-sender contract-caller INTERCHAIN-TOKEN-SERVICE))

;; Getter for the contract id.
;; @return (buff 32) The contract id.
(define-read-only (contract-id)
    (ok CONTRACT-ID))

;; Reads the managed token address
;; @return principal The address of the token.
(define-read-only (token-address)
    (ok TOKEN-ADDRESS))

;; A function that returns the interchain token id.
;; @return (buff 32) The interchain token ID.
(define-read-only (interchain-token-id)
    (ok INTERCHAIN-TOKEN-ID))

;; Query if an address is a operator.
;; @param addr The address to query for.
;; @return bool Boolean value representing whether or not the address is an operator.
(define-read-only (is-operator (address principal)) 
    (ok (default-to false (get operator (map-get? roles tx-sender)))))


;; This function adds a flow limiter for this TokenManager.
;; Can only be called by the operator.
;; @param flowLimiter the address of the new flow limiter.
(define-public (add-flow-limiter (address principal))
    (begin
        ;; FIXME: Should this be guarded by contract-caller instead preventing contract calls from modifying?
        (asserts! (unwrap-panic (is-operator tx-sender)) ERR-NOT-AUTHORIZED)
        (match (map-get? roles address) 
            limiter-roles (ok (map-set roles address (merge limiter-roles {flow-limiter: true})))
            (ok (map-set roles address  {flow-limiter: true, operator: false})))))

;; This function removes a flow limiter for this TokenManager.
;; Can only be called by the operator.
;; @param flowLimiter the address of an existing flow limiter.
(define-public (remove-flow-limiter (address principal))
    (begin 
        ;; FIXME: Should this be guarded by contract-caller instead preventing contract calls from modifying?
        (asserts! (unwrap-panic (is-operator tx-sender)) ERR-NOT-AUTHORIZED)
        (match (map-get? roles address) 
            ;; no need to check limiter if they don't exist it will be a noop
            limiter-roles (ok (map-set roles address (merge limiter-roles {flow-limiter: false})))
            (ok true))))
;; Query if an address is a flow limiter.
;; @param addr The address to query for.
;; @return bool Boolean value representing whether or not the address is a flow limiter.
(define-read-only (is-flow-limiter (addr principal))
    (default-to false (get flow-limiter (map-get? roles addr))))

;;     /**
;;      * @notice A function to renew approval to the service if we need to.
;;      */
;;     function approveService() external onlyService {
;;         /**
;;          * @dev Some tokens may not obey the infinite approval.
;;          * Even so, it is unexpected to run out of allowance in practice.
;;          * If needed, we can upgrade to allow replenishing the allowance in the future.
;;          */
;;         IERC20(this.tokenAddress()).safeCall(abi.encodeWithSelector(IERC20.approve.selector, interchainTokenService, UINT256_MAX));
;;     }

;;     /**
;;      * @notice Getter function for the parameters of a lock/unlock TokenManager.
;;      * @dev This function will be mainly used by frontends.
;;      * @param operator_ The operator of the TokenManager.
;;      * @param tokenAddress_ The token to be managed.
;;      * @return params_ The resulting params to be passed to custom TokenManager deployments.
;;      */
;;     function params(bytes calldata operator_, address tokenAddress_) external pure returns (bytes memory params_) {
;;         params_ = abi.encode(operator_, tokenAddress_);
;;     }

;;     /**
;;      * @notice External function to allow the service to mint tokens through the tokenManager
;;      * @dev This function should revert if called by anyone but the service.
;;      * @param tokenAddress_ The address of the token, since its cheaper to pass it in instead of reading it as the token manager.
;;      * @param to The recipient.
;;      * @param amount The amount to mint.
;;      */
;;     function mintToken(address tokenAddress_, address to, uint256 amount) external onlyService {
;;         IERC20(tokenAddress_).safeCall(abi.encodeWithSelector(IERC20MintableBurnable.mint.selector, to, amount));
;;     }

;;     /**
;;      * @notice External function to allow the service to burn tokens through the tokenManager
;;      * @dev This function should revert if called by anyone but the service.
;;      * @param tokenAddress_ The address of the token, since its cheaper to pass it in instead of reading it as the token manager.
;;      * @param from The address to burn the token from.
;;      * @param amount The amount to burn.
;;      */
;;     function burnToken(address tokenAddress_, address from, uint256 amount) external onlyService {
;;         IERC20(tokenAddress_).safeCall(abi.encodeWithSelector(IERC20MintableBurnable.burn.selector, from, amount));
;;     }
;; }

(define-constant ERR-NOT-AUTHORIZED (err u2051))
(define-constant ERR-FLOW-LIMIT-EXCEEDED (err u2052))
;; 6 BTC hours
(define-constant EPOCH-TIME u36)
(define-data-var flow-limit uint u0)
(define-map flows uint {
    flow-in: uint,
    flow-out: uint,
})

;;     
;; Returns the current flow limit.
;; @return The current flow limit value.
;;      
(define-read-only (get-flow-limit) 
    (ok (var-get flow-limit)))

;; This function sets the flow limit for this TokenManager.
;; Can only be called by the flow limiters.
;; @param flowLimit_ The maximum difference between the tokens 
;; flowing in and/or out at any given interval of time (6h).
(define-public (set-flow-limit (limit uint))
    (let (
        (perms (unwrap! (map-get? roles tx-sender) ERR-NOT-AUTHORIZED))
    )
    (asserts! (get flow-limiter perms) ERR-NOT-AUTHORIZED)
    ;; no need to check can be set to 0 to practically make it unlimited
    (var-set flow-limit limit)
    (ok true))
)

;; Returns the current flow out amount.
;; @return flowOutAmount_ The current flow out amount.
(define-read-only (get-flow-out-amount)
    (let (
            (epoch (/ burn-block-height EPOCH-TIME))
        )
        (ok (default-to u0 (get flow-out (map-get? flows epoch))))))

;; Returns the current flow in amount.
;; @return flowInAmount_ The current flow in amount.
(define-read-only (get-flow-in-amount)
    (let ((epoch (/ burn-block-height EPOCH-TIME)))
        (ok (default-to u0 (get flow-in (map-get? flows epoch))))))

;; Adds a flow out amount while ensuring it does not exceed the flow limit.
;; @param flow-amount The flow out amount to add.
(define-public (add-flow-out (flow-amount uint))
    (let (
            (limit  (var-get flow-limit))
            (epoch  (/ burn-block-height EPOCH-TIME))
            (current-flow-out   (unwrap-panic (get-flow-out-amount)))
            (current-flow-in  (unwrap-panic (get-flow-in-amount)))
            (new-flow-out (+ current-flow-out flow-amount))
        )
        (asserts! (is-eq tx-sender INTERCHAIN-TOKEN-SERVICE) ERR-NOT-AUTHORIZED)
        (asserts! (<= new-flow-out (+ current-flow-in limit)) ERR-FLOW-LIMIT-EXCEEDED)
        (asserts! (< new-flow-out limit) ERR-FLOW-LIMIT-EXCEEDED)
        (if (is-eq limit u0)
            (ok true)
            (begin
                (map-set flows epoch {
                    flow-out: new-flow-out,
                    flow-in: current-flow-in
                })
                (ok true)))))

;; Adds a flow in amount while ensuring it does not exceed the flow limit.
;; @param flow-amount The flow out amount to add.
(define-public  (add-flow-in  (flow-amount uint))
    (let (
                (limit   (var-get flow-limit))
                (epoch   (/ burn-block-height EPOCH-TIME))
                (current-flow-out    (unwrap-panic  (get-flow-out-amount)))
                (current-flow-in (unwrap-panic (get-flow-in-amount)))
                (new-flow-in (+ current-flow-out flow-amount)))
            (asserts! (is-eq tx-sender INTERCHAIN-TOKEN-SERVICE) ERR-NOT-AUTHORIZED)
            (asserts!  (<= new-flow-in (+ current-flow-out limit)) ERR-FLOW-LIMIT-EXCEEDED)
            (asserts!  (< new-flow-in limit) ERR-FLOW-LIMIT-EXCEEDED)
            (if  (is-eq limit u0)
                (ok true)
                (begin
                    (map-set flows epoch {
                        flow-out: current-flow-out,
                        flow-in: new-flow-in
                    })
                    (ok true)))))
