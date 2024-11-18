(impl-trait .traits.proxy-trait)
(use-trait gas-impl-trait .traits.gas-service-impl-trait)

;; ######################
;; ######################
;; ### Proxy Calls ######
;; ######################
;; ######################

(define-constant ERR-INVALID-IMPL (err u10211))

(define-private (is-correct-impl (gas-impl <gas-impl-trait>)) (is-eq (contract-call? .gas-storage get-impl) (contract-of gas-impl)))

;; Proxy all gas service functions to implementation
(define-public (pay-native-gas-for-contract-call
    (gas-impl <gas-impl-trait>)
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload (buff 64000))
    (refund-address principal))
    (begin
        (asserts! (is-eq (is-correct-impl gas-impl) true) ERR-INVALID-IMPL)
        (contract-call? gas-impl
            pay-native-gas-for-contract-call
            amount
            sender
            destination-chain
            destination-address
            payload
            refund-address))
)

(define-public (add-native-gas
    (gas-impl <gas-impl-trait>)
    (amount uint)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (begin
        (asserts! (is-eq (is-correct-impl gas-impl) true) ERR-INVALID-IMPL)
        (contract-call? gas-impl
            add-native-gas
            amount
            tx-hash
            log-index
            refund-address))
)

(define-public (refund
    (gas-impl <gas-impl-trait>)
    (tx-hash (buff 32))
    (log-index uint)
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-eq (is-correct-impl gas-impl) true) ERR-INVALID-IMPL)
        (contract-call? gas-impl
            refund
            tx-hash
            log-index
            receiver
            amount))
)

(define-public (collect-fees
    (gas-impl <gas-impl-trait>)
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-eq (is-correct-impl gas-impl) true) ERR-INVALID-IMPL)
        (contract-call? gas-impl
            collect-fees
            receiver
            amount))
)

;; Read-only functions
(define-public (get-balance (gas-impl <gas-impl-trait>))
    (begin
        (asserts! (is-eq (is-correct-impl gas-impl) true) ERR-INVALID-IMPL)
        (contract-call? gas-impl get-balance))
)

;; Add unimplemented functions from the trait
(define-public (pay-gas-for-contract-call
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload (buff 64000))
    (refund-address principal))
    (err u103))  ;; err-not-implemented

(define-public (add-gas
    (amount uint)
    (sender principal)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (err u103))  ;; err-not-implemented

(define-public (pay-native-gas-for-express-call
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload (buff 64000))
    (refund-address principal))
    (err u103))  ;; err-not-implemented

(define-public (add-native-express-gas
    (amount uint)
    (sender principal)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (err u103))  ;; err-not-implemented 


;; ######################
;; ######################
;; ### Upgradability ####
;; ######################
;; ######################

(define-constant ERR-UNAUTHORIZED (err u10111))

(define-private (is-governance) (is-eq contract-caller (contract-call? .gas-storage get-governance)))

(define-public (set-impl (new principal))
    (let
        (
            (prev (contract-call? .gas-storage get-impl))
        ) 
        (asserts! (is-eq (is-governance) true) ERR-UNAUTHORIZED)
        (try! (contract-call? .gas-storage set-impl new))
        (print {
            type: "gas-impl-updated",
            prev: prev,
            new: new
        })
        (ok true)
    )
)

(define-public (set-governance (new principal))
    (let
        (
            (prev (contract-call? .gas-storage get-governance))
        ) 
        (asserts! (is-eq (is-governance) true) ERR-UNAUTHORIZED)
        (try! (contract-call? .gas-storage set-governance new))
        (print {
            type: "gas-governance-updated",
            prev: prev,
            new: new
        })
        (ok true)
    )
)


;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

(define-constant ERR-STARTED (err u6051))

;; Constructor function
(define-public (setup
    (operator_ principal)
)
    (begin
        (asserts! (is-eq (contract-call? .gas-storage get-is-started) false) ERR-STARTED)
        (try! (contract-call? .gas-storage set-operator operator_))
        (try! (contract-call? .gas-storage start))
        (ok true)
    )
)
