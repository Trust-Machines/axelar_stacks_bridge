;; Gas Service Contract

(impl-trait .traits.gas-service-trait)

;; Define constants
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))
(define-constant err-not-implemented (err u103))
(define-constant err-invalid-sender (err u104))

;; Define data variables
(define-data-var owner principal tx-sender)

;; Public function for native gas payment for contract call
(define-public (pay-native-gas-for-contract-call 
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 32))
    (destination-address (string-ascii 128))
    (payload (buff 10240))
    (refund-address principal))
    (begin
        (asserts! (> amount u0) err-invalid-amount)
        ;; Transfer STX from the caller to the contract
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (print {
            type: "native-gas-paid-for-contract-call", 
            sender: sender, 
            amount: amount, 
            refund-address: refund-address,
            destination-chain: destination-chain,
            destination-address: destination-address,
            payload-hash: (keccak256 payload)
        })
        (ok true)
    )
)

;; Public function to add native gas (deduct from contract balance)
(define-public (add-native-gas 
    (amount uint)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (begin
        (asserts! (> amount u0) err-invalid-amount)
        ;; Transfer STX from the caller to the contract
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (print {
            type: "native-gas-added", 
            amount: amount, 
            refund-address: refund-address,
            tx-hash: tx-hash,
            log-index: log-index
        })
        (ok true)
    )
)

;; Function to refund gas (transfer from contract balance to receiver)
(define-public (refund 
    (tx-hash (buff 32))
    (log-index uint)
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-eq tx-sender (var-get owner)) err-owner-only)
        (asserts! (> amount u0) err-invalid-amount)
        (asserts! (<= amount (stx-get-balance (as-contract tx-sender))) err-insufficient-balance)
        (try! (as-contract (stx-transfer? amount tx-sender receiver)))
        (print {
            type: "refunded", 
            tx-hash: tx-hash,
            log-index: log-index,
            receiver: receiver, 
            amount: amount
        })
        (ok true)
    )
)

;; Public function to collect fees (transfer STX from contract to receiver)
(define-public (collect-fees 
    (receiver principal)
    (amount uint))
    (begin
        ;; Ensure only the owner can call this function
        (asserts! (is-eq tx-sender (var-get owner)) err-owner-only)
        
        ;; Ensure the amount is greater than zero
        (asserts! (> amount u0) err-invalid-amount)
        
        ;; Ensure the contract has sufficient balance
        (asserts! (<= amount (stx-get-balance (as-contract tx-sender))) err-insufficient-balance)
        
        ;; Transfer STX from the contract to the receiver
        (try! (as-contract (stx-transfer? amount tx-sender receiver)))
        
        ;; Log the fee collection
        (print {
            type: "fees-collected", 
            receiver: receiver, 
            amount: amount
        })
        
        (ok true)
    )
)

;; Placeholder for future implementation: pay gas for contract call
(define-public (pay-gas-for-contract-call 
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 32))
    (destination-address (string-ascii 128))
    (payload (buff 10240))
    (refund-address principal))
    (err err-not-implemented)
)

;; Placeholder for future implementation: add gas
(define-public (add-gas 
    (amount uint)
    (sender principal)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (err err-not-implemented)
)

;; Placeholder for future implementation: pay native gas for express call
(define-public (pay-native-gas-for-express-call 
    (amount uint)
    (sender principal)
    (destination-chain (string-ascii 32))
    (destination-address (string-ascii 128))
    (payload (buff 10240))
    (refund-address principal))
    (err err-not-implemented)
)

;; Placeholder for future implementation: add native express gas
(define-public (add-native-express-gas 
    (amount uint)
    (sender principal)
    (tx-hash (buff 32))
    (log-index uint)
    (refund-address principal))
    (err err-not-implemented)
)

;; Public function to transfer ownership
(define-public (transfer-ownership (new-owner principal))
    (begin
        (asserts! (is-eq tx-sender (var-get owner)) err-owner-only)
        (var-set owner new-owner)
        (print {type: "ownership-transferred", new-owner: new-owner})
        (ok true)
    )
)

;; Read-only function to get the current balance
(define-read-only (get-balance)
    (ok (stx-get-balance (as-contract tx-sender)))
)

;; Read-only function to check if the caller is the contract owner
(define-read-only (is-owner)
    (ok (is-eq tx-sender (var-get owner)))
)

;; Read-only function to get the current contract owner
(define-read-only (get-owner)
    (ok (var-get owner))
)
