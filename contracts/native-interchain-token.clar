
;; title: mintable-burnable-sip-010
;; version:
;; summary:
;; description:

;; traits
;;
(impl-trait .token-manager-trait.token-manager-trait)
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-constant ERR-NOT-AUTHORIZED (err u1051))


;; ##########################
;; ##########################
;; ######  SIP-010  #########
;; ##########################
;; ##########################

(define-constant ERR-INSUFFICIENT-BALANCE (err u2051))
(define-constant ERR-INVALID-PARAMS (err u2052))
(define-constant ERR-ZERO-AMOUNT (err u2053))

(define-fungible-token itscoin)

(define-data-var decimals uint u0)
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-data-var name (string-ascii 32) "not-initialized")
(define-data-var symbol (string-ascii 32) "not-initialized")
(define-read-only (get-balance (address principal))
    (ok (ft-get-balance itscoin address)))

(define-read-only (get-decimals)
    (ok (var-get decimals))
)

(define-read-only (get-total-supply)
    (ok (ft-get-supply itscoin)))

(define-read-only (get-token-uri)
    (ok (var-get token-uri)))

(define-read-only (get-name)
    (ok (var-get name)))

(define-read-only (get-symbol)
    (ok (var-get symbol)))

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (asserts! (is-eq from tx-sender) ERR-NOT-AUTHORIZED)
        (asserts! (not (is-eq to tx-sender)) ERR-INVALID-PARAMS)
        (asserts! (> amount u0) ERR-ZERO-AMOUNT)
        (asserts! (>= (ft-get-balance itscoin from) amount) ERR-INSUFFICIENT-BALANCE)
        (print (default-to 0x memo))
        (ft-transfer? itscoin amount from to)))

;; constants
;;
(define-constant TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN u0)

(define-constant MINTER .interchain-token-service)

(define-constant ERR-NOT-MANAGED-TOKEN (err u2053))



;; ##########################
;; ##########################
;; ####  token manager  #####
;; ##########################
;; ##########################

(define-private (burn (from principal) (amount uint))
    (ft-burn? itscoin amount from)
)

(define-private (mint (from principal) (amount uint))
    (ft-mint? itscoin amount from)
)

;; Reads the managed token address
;; @return principal The address of the token.
(define-read-only (get-token-address)
    (ok (as-contract tx-sender)))

(define-read-only (get-token-type)
    (ok TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN))

;; @notice rares: mint burn give/take will be handled in the token mintable-burnable itself 
;; the flow would still be handled by the ITS
;; subject to change
(define-public (take-token (token <sip-010-trait>) (from principal) (amount uint))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (asserts! (> amount u0) ERR-ZERO-AMOUNT)
        (asserts! (not (is-eq from (as-contract tx-sender))) ERR-INVALID-PARAMS)
        (asserts! (is-eq tx-sender MINTER) ERR-NOT-AUTHORIZED)
        (try! (add-flow-out amount))
        (burn from amount))
)

(define-public (give-token (token <sip-010-trait>) (to principal) (amount uint))
    (begin
        (asserts! (> amount u0) ERR-ZERO-AMOUNT)
        (asserts! (not (is-eq to (as-contract tx-sender))) ERR-INVALID-PARAMS)
        (asserts! (is-eq tx-sender MINTER) ERR-NOT-AUTHORIZED)
        (try! (add-flow-in amount))
        (mint to amount)))


(define-map roles principal {
    operator: bool,
    flow-limiter: bool,
})


;; ######################
;; ######################
;; ##### Flow Limit #####
;; ######################
;; ######################

;; 6 BTC hours
(define-constant EPOCH-TIME u36)

(define-constant ERR-FLOW-LIMIT-EXCEEDED (err u2051))

(define-map flows uint {
    flow-in: uint,
    flow-out: uint,
})
(define-data-var flow-limit uint u0)

;; This function adds a flow limiter for this TokenManager.
;; Can only be called by the operator.
;; @param flowLimiter the address of the new flow limiter.
;; #[allow(unchecked_data)]
(define-public (add-flow-limiter (address principal))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (asserts! (unwrap-panic (is-operator contract-caller)) ERR-NOT-AUTHORIZED)
        (match (map-get? roles address) 
            limiter-roles (ok (map-set roles address (merge limiter-roles {flow-limiter: true})))
            (ok (map-set roles address  {flow-limiter: true, operator: false})))))

;; This function removes a flow limiter for this TokenManager.
;; Can only be called by the operator.
;; @param flowLimiter the address of an existing flow limiter.
;; #[allow(unchecked_data)]
(define-public (remove-flow-limiter (address principal))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (asserts! (unwrap-panic (is-operator contract-caller)) ERR-NOT-AUTHORIZED)
        (match (map-get? roles address) 
            ;; no need to check limiter if they don't exist it will be a noop
            limiter-roles (ok (map-set roles address (merge limiter-roles {flow-limiter: false})))
            (ok true))))

;; Query if an address is a flow limiter.
;; @param addr The address to query for.
;; @return bool Boolean value representing whether or not the address is a flow limiter.
(define-read-only (is-flow-limiter (addr principal))
    (ok (default-to false (get flow-limiter (map-get? roles addr)))))

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
;; #[allow(unchecked_data)]
(define-public (set-flow-limit (limit uint))
    (let (
        (perms (unwrap! (map-get? roles contract-caller) ERR-NOT-AUTHORIZED))
    )
    (asserts! (var-get is-started) ERR-NOT-STARTED)
    (asserts! (get flow-limiter perms) ERR-NOT-AUTHORIZED)
    ;; no need to check can be set to 0 to practically makes it unlimited
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
(define-private (add-flow-out (flow-amount uint))
    (let (
            (limit  (var-get flow-limit))
            (epoch  (/ burn-block-height EPOCH-TIME))
            (current-flow-out   (unwrap-panic (get-flow-out-amount)))
            (current-flow-in  (unwrap-panic (get-flow-in-amount)))
            (new-flow-out (+ current-flow-out flow-amount))
        )
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
(define-private  (add-flow-in  (flow-amount uint))
    (let (
            (limit   (var-get flow-limit))
            (epoch   (/ burn-block-height EPOCH-TIME))
            (current-flow-out    (unwrap-panic  (get-flow-out-amount)))
            (current-flow-in (unwrap-panic (get-flow-in-amount)))
            (new-flow-in (+ current-flow-in flow-amount)))
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


;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

(define-constant ERR-STARTED (err u4051))
(define-constant ERR-NOT-STARTED (err u4052))
(define-constant ERR-UNSUPPORTED-TOKEN-TYPE (err u4053))
(define-constant OWNER tx-sender)

(define-data-var interchain-token-service (optional principal) none)
(define-data-var token-type (optional uint) none)

(define-data-var is-started bool false)
(define-read-only (get-is-started) (var-get is-started))
;; Constructor function
;; @returns (response true) or reverts
(define-public (setup 
    (token-type_ uint)
    (its-address principal)
    (operator-address (optional principal))
) 
    (begin
        (asserts! (is-eq contract-caller OWNER) ERR-NOT-AUTHORIZED)
        (asserts! (is-eq (var-get is-started) false) ERR-STARTED)
        (asserts! (is-eq token-type_ TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN) ERR-UNSUPPORTED-TOKEN-TYPE)
        (var-set is-started true)
        ;; #[allow(unchecked_data)]
        (var-set token-type (some token-type_))
        ;; #[allow(unchecked_data)]
        (var-set interchain-token-service (some its-address))
        ;; #[allow(unchecked_data)]
        (map-set roles its-address {
            operator: true,
            flow-limiter: true,
        })
        (ok (match operator-address op 
            (map-set roles op {
                operator: true,
                flow-limiter: true,
            })
            true))
    )
)

;; ####################
;; ####################
;; ### Operatorship ###
;; ####################
;; ####################

(define-constant ERR-ONLY-OPERATOR (err u5051))


(define-read-only (is-operator-raw (address principal)) 
    (default-to false (get operator (map-get? roles address))))

(define-read-only (is-operator (address principal)) 
    (ok (is-operator-raw address)))

;; Transfers operatorship to a new account
(define-public (transfer-operatorship (new-operator principal))
    (begin
        (asserts! (var-get is-started) ERR-NOT-STARTED)
        (asserts! (is-operator-raw contract-caller) ERR-ONLY-OPERATOR)
        (map-delete roles contract-caller)
        ;; #[allow(unchecked_data)]
        (map-set roles new-operator {
            operator: true,
            flow-limiter: true,
        })
        (print {action: "transfer-operatorship", new-operator: new-operator})
        (ok u1)
    )
)