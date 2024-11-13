(impl-trait .traits.gas-service-impl-trait)
(use-trait storage-trait .traits.gas-storage-trait)

;; Define constants
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))
(define-constant err-unauthorized (err u103))
(define-constant err-invalid-sender (err u104))
(define-constant NULL-PRINCIPAL 'SP000000000000000000002Q6VF78)
(define-constant ERR-INVALID-PRINCIPAL (err u105))
(define-constant err-not-started (err u106))

;; Proxy contract reference
(define-constant PROXY .gas-service)

;; Check if caller is the proxy contract
(define-private (is-proxy)
    (is-eq contract-caller PROXY))

(define-private (assert-started)
    (if (contract-call? .gas-storage get-is-started)
        (ok true)
        err-not-started))

;; Public function for native gas payment for contract call
(define-public (pay-native-gas-for-contract-call
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload (buff 64000))
    (refund-address principal))
    (begin
        (asserts! (is-proxy) err-unauthorized)
        (try! (assert-started))
        (asserts! (> amount u0) err-invalid-amount)
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (try! (contract-call? .gas-storage emit-gas-paid-event
            sender
            amount
            refund-address
            destination-chain
            destination-address
            (keccak256 payload)))
        (ok true)
    )
)

(define-public (add-native-gas
    (amount uint)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (begin
        (asserts! (is-proxy) err-unauthorized)
        (try! (assert-started))
        (asserts! (> amount u0) err-invalid-amount)
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (try! (contract-call? .gas-storage emit-gas-added-event
            amount
            refund-address
            tx-hash
            log-index))
        (ok true)
    )
)

(define-private (validate-principal (address principal))
    (if (not (is-eq address NULL-PRINCIPAL))
        (ok true)
        ERR-INVALID-PRINCIPAL))

(define-public (refund
    (tx-hash (buff 32))
    (log-index uint)
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-proxy) err-unauthorized)
        (try! (assert-started))
        (asserts! (is-eq tx-sender (unwrap! (contract-call? .gas-storage get-owner) err-unauthorized)) err-unauthorized)
        (asserts! (> amount u0) err-invalid-amount)
        (asserts! (<= amount (stx-get-balance (as-contract tx-sender))) err-insufficient-balance)
        (try! (validate-principal receiver))
        (try! (as-contract (stx-transfer? amount tx-sender receiver)))
        (try! (contract-call? .gas-storage emit-refund-event
            tx-hash
            log-index
            receiver
            amount))
        (ok true)
    )
)

;; Update collect-fees function with validation
(define-public (collect-fees
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-proxy) err-unauthorized)
        (try! (assert-started))
        (asserts! (is-eq tx-sender (unwrap! (contract-call? .gas-storage get-owner) err-unauthorized)) err-unauthorized)
        (asserts! (> amount u0) err-invalid-amount)
        (asserts! (<= amount (stx-get-balance (as-contract tx-sender))) err-insufficient-balance)
        (try! (validate-principal receiver))
        (try! (as-contract (stx-transfer? amount tx-sender receiver)))
        (try! (contract-call? .gas-storage emit-fees-collected-event receiver amount))
        (ok true)
    )
)

;; Update transfer-ownership function with validation
(define-public (transfer-ownership (new-owner principal))
    (begin
        (asserts! (is-proxy) err-unauthorized)
        (try! (assert-started))
        (asserts! (is-eq tx-sender (unwrap! (contract-call? .gas-storage get-owner) err-unauthorized)) err-unauthorized)
        (try! (validate-principal new-owner))
        (try! (contract-call? .gas-storage set-owner new-owner))
        (ok true)
    )
)

(define-public (get-owner)
    (contract-call? .gas-storage get-owner))

(define-read-only (get-balance)
    (ok (stx-get-balance (as-contract tx-sender)))
)