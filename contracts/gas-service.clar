(impl-trait .traits.gas-service-impl-trait)
(use-trait gas-impl-trait .traits.gas-service-impl-trait)

;; Error constants
(define-constant err-owner-only (err u100))
(define-constant err-already-initialized (err u101))
(define-constant ERR-INVALID-IMPL (err u102))

;; Only keep implementation reference for future upgrades
(define-data-var implementation principal .gas-impl)

;; Helper function to validate implementation
(define-private (is-valid-impl (impl <gas-impl-trait>))
    (is-eq (var-get implementation) (contract-of impl)))

;; Initialize the contract
(define-public (initialize (impl principal))
    (begin
        ;; Check owner through storage contract
        (asserts! (is-eq tx-sender (unwrap! (contract-call? .gas-storage get-owner) err-owner-only)) err-owner-only)
        (var-set implementation impl)
        (ok true)))

;; Upgrade the implementation
(define-public (upgrade (new-impl principal))
    (begin
        ;; Check owner through storage contract
        (asserts! (is-eq tx-sender (unwrap! (contract-call? .gas-storage get-owner) err-owner-only)) err-owner-only)
        (var-set implementation new-impl)
        (ok true)))

;; Proxy all gas service functions to implementation
(define-public (pay-native-gas-for-contract-call
    (impl <gas-impl-trait>)
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload (buff 64000))
    (refund-address principal))
    (begin
        (asserts! (is-valid-impl impl) ERR-INVALID-IMPL)
        (contract-call? impl
            pay-native-gas-for-contract-call
            amount
            sender
            destination-chain
            destination-address
            payload
            refund-address))
)

(define-public (add-native-gas
    (impl <gas-impl-trait>)
    (amount uint)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (begin
        (asserts! (is-valid-impl impl) ERR-INVALID-IMPL)
        (contract-call? impl
            add-native-gas
            amount
            tx-hash
            log-index
            refund-address))
)

(define-public (refund
    (impl <gas-impl-trait>)
    (tx-hash (buff 32))
    (log-index uint)
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-valid-impl impl) ERR-INVALID-IMPL)
        (contract-call? impl
            refund
            tx-hash
            log-index
            receiver
            amount))
)

(define-public (collect-fees
    (impl <gas-impl-trait>)
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-valid-impl impl) ERR-INVALID-IMPL)
        (contract-call? impl
            collect-fees
            receiver
            amount))
)

(define-public (transfer-ownership
    (impl <gas-impl-trait>)
    (new-owner principal))
    (begin
        (asserts! (is-valid-impl impl) ERR-INVALID-IMPL)
        (contract-call? impl
            transfer-ownership
            new-owner))
)

;; Read-only functions
(define-public (get-balance (impl <gas-impl-trait>))
    (begin
        (asserts! (is-valid-impl impl) ERR-INVALID-IMPL)
        (contract-call? impl get-balance))
)

(define-public (get-owner (impl <gas-impl-trait>))
    (begin
        (asserts! (is-valid-impl impl) ERR-INVALID-IMPL)
        (contract-call? impl get-owner))
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