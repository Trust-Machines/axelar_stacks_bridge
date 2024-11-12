(impl-trait .traits.gas-service-trait)

;; Error constants
(define-constant err-owner-only (err u100))
(define-constant err-already-initialized (err u101))

;; Data vars
(define-data-var implementation principal .gas.impl)
(define-data-var owner principal tx-sender)

;; Initialize the contract
(define-public (initialize (impl principal))
    (begin
        (asserts! (is-eq tx-sender (var-get owner)) err-owner-only)
        (var-set implementation impl)
        (ok true)))

;; Upgrade the implementation
(define-public (upgrade (new-impl principal))
    (begin
        (asserts! (is-eq tx-sender (var-get owner)) err-owner-only)
        (var-set implementation new-impl)
        (ok true)))

;; Proxy all gas service functions to implementation
(define-public (pay-native-gas-for-contract-call
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload (buff 64000))
    (refund-address principal))
    (contract-call? (var-get implementation)
        pay-native-gas-for-contract-call
        amount
        sender
        destination-chain
        destination-address
        payload
        refund-address))

(define-public (add-native-gas
    (amount uint)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (contract-call? (var-get implementation)
        add-native-gas
        amount
        tx-hash
        log-index
        refund-address))

(define-public (refund
    (tx-hash (buff 32))
    (log-index uint)
    (receiver principal)
    (amount uint))
    (contract-call? (var-get implementation)
        refund
        tx-hash
        log-index
        receiver
        amount))

(define-public (collect-fees
    (receiver principal)
    (amount uint))
    (contract-call? (var-get implementation)
        collect-fees
        receiver
        amount))

(define-public (transfer-ownership
    (new-owner principal))
    (contract-call? (var-get implementation)
        transfer-ownership
        new-owner))

;; Read-only functions
(define-read-only (get-balance)
    (contract-call? (var-get implementation) get-balance))

(define-read-only (is-owner)
    (contract-call? (var-get implementation) is-owner))

(define-read-only (get-owner)
    (contract-call? (var-get implementation) get-owner)) 