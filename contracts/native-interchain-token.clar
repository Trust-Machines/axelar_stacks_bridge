
;; title: mintable-burnable-sip-010
;; version:
;; summary:
;; description:

;; traits
;;
(impl-trait .token-manager-trait.token-manager-trait)
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(use-trait sip-010-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

;;   (transfer (uint principal principal (optional (buff 34))) (response bool uint))

;; token definitions
;;

(define-fungible-token itscoin)
;; constants
;;
(define-constant TOKEN-TYPE-NATIVE-INTERCHAIN-TOKEN u0)

(define-constant MINTER .interchain-token-service)
(define-constant ERR-NOT-AUTHORIZED (err u1051))
(define-constant ERR-INVALID-PARAMS (err u1052))
(define-constant ERR-YOU-POOR (err u1053))
(define-constant ERR-FLOW-LIMIT-EXCEEDED (err u2052))
(define-constant ERR-NOT-MANAGED-TOKEN (err u2053))
(define-constant ERR-UNSUPPORTED-TOKEN-TYPE (err u2054))

;; data vars
;;

;; data maps
;;

;; public functions
;;
(define-private (burn (from principal) (amount uint))
    (begin
        (asserts! (is-eq MINTER tx-sender) ERR-NOT-AUTHORIZED)
        (asserts! (> amount u0) ERR-INVALID-PARAMS)
        (ft-burn? itscoin amount from)
    )
)

(define-private (mint (from principal) (amount uint))
    (begin
        (asserts! (is-eq MINTER tx-sender) ERR-NOT-AUTHORIZED)
        (asserts! (> amount u0) ERR-INVALID-PARAMS)
        (ft-mint? itscoin amount from)
    )
)

(define-public (transfer (amount uint) (from principal) (to principal) (memo (optional (buff 34))))
    (begin
        (asserts! (is-eq from tx-sender) ERR-NOT-AUTHORIZED)
        (asserts! (not (is-eq to tx-sender)) ERR-INVALID-PARAMS)
        (asserts! (>= (ft-get-balance itscoin from) amount) ERR-YOU-POOR)
        (print (default-to 0x memo))
        (ft-transfer? itscoin amount from to)))
;; read only functions
;;
(define-read-only (get-balance (address principal)) 
    (ok (ft-get-balance itscoin address)))

(define-read-only (get-decimals)
    (ok u6)
)

(define-read-only (get-total-supply)
    (ok (ft-get-supply itscoin)))

(define-read-only (get-token-uri)
    (ok none))

(define-read-only (get-name)
    (ok "itscoin"))

(define-read-only (get-symbol)
    (ok "ITS"))
;; private functions
;;

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
        (asserts! (is-eq tx-sender MINTER) ERR-NOT-AUTHORIZED)
        (try! (add-flow-out amount))
        (burn from amount))
)

(define-public (give-token (token <sip-010-trait>) (to principal) (amount uint))
    (begin
        (asserts! (is-eq tx-sender MINTER) ERR-NOT-AUTHORIZED)
        (try! (add-flow-in amount))
        ;; #[filter(amount)]
        (mint to amount))
)
;; Flow control
;; 6 BTC hours
(define-constant EPOCH-TIME u36)
(define-data-var flow-limit uint u0)

(define-map roles principal {
    operator: bool,
    flow-limiter: bool,
})

(define-map flows uint {
    flow-in: uint,
    flow-out: uint,
})


;; Query if an address is a operator.
;; @param addr The address to query for.
;; @return bool Boolean value representing whether or not the address is an operator.
(define-read-only (is-operator (address principal)) 
    (ok (default-to false (get operator (map-get? roles address)))))


;; This function adds a flow limiter for this TokenManager.
;; Can only be called by the operator.
;; @param flowLimiter the address of the new flow limiter.
;; #[allow(unchecked_data)]
(define-public (add-flow-limiter (address principal))
    (begin
        (asserts! (unwrap-panic (is-operator contract-caller)) ERR-NOT-AUTHORIZED)
        (match (map-get? roles address) 
            limiter-roles (ok (map-set roles address (merge limiter-roles {flow-limiter: true})))
            (ok (map-set roles address  {flow-limiter: true, operator: false})))))

;; This function removes a flow limiter for this TokenManager.
;; Can only be called by the operator.
;; @param flowLimiter the address of an existing flow limiter.
(define-public (remove-flow-limiter (address principal))
    (begin 
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
(define-public (set-flow-limit (limit uint))
    (let (
        (perms (unwrap! (map-get? roles tx-sender) ERR-NOT-AUTHORIZED))
    )
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
