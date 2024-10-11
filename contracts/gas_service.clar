;; Gas Service Contract

;; Define constants
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-invalid-amount (err u102))

;; Define data variables
(define-data-var contract-balance uint u0)
(define-data-var contract-owner principal tx-sender)

;; Public function for native gas payment for contract call
(define-public (pay-native-gas-for-contract-call 
    (amount uint)
    (refund-address principal)
    (destination-chain (string-ascii 32))
    (destination-address (string-ascii 40))
    (payload (buff 1024)))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) err-owner-only)
        (asserts! (> amount u0) err-invalid-amount)
        (asserts! (<= amount (var-get contract-balance)) err-insufficient-balance)
        (var-set contract-balance (- (var-get contract-balance) amount))
        (print {
            event: "NativeGasPaidForContractCall", 
            sender: tx-sender, 
            amount: amount, 
            refundAddress: refund-address,
            destinationChain: destination-chain,
            destinationAddress: destination-address,
            payloadHash: (sha256 payload)
        })
        (ok true)
    )
)

;; Public function to add native gas (deduct from contract balance)
(define-public (add-native-gas 
    (amount uint)
    (refund-address principal)
    (tx-hash (buff 32))
    (log-index uint))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) err-owner-only)
        (asserts! (> amount u0) err-invalid-amount)
        (asserts! (<= amount (var-get contract-balance)) err-insufficient-balance)
        (var-set contract-balance (- (var-get contract-balance) amount))
        (print {
            event: "NativeGasAdded", 
            sender: tx-sender, 
            amount: amount, 
            refundAddress: refund-address,
            txHash: tx-hash,
            logIndex: log-index
        })
        (ok true)
    )
)

;; Function to refund gas (add to contract balance)
(define-public (refund (amount uint) (receiver principal))
    (begin
        (asserts! (> amount u0) err-invalid-amount)
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (var-set contract-balance (+ (var-get contract-balance) amount))
        (print {event: "Refunded", receiver: receiver, amount: amount})
        (ok true)
    )
)

;; Placeholder for future implementation: pay gas for contract call
(define-public (pay-gas-for-contract-call 
    (amount uint)
    (refund-address principal)
    (destination-chain (string-ascii 32))
    (destination-address (string-ascii 40))
    (payload (buff 1024)))
    (err u0) ;; Not implemented
)

;; Placeholder for future implementation: add gas
(define-public (add-gas 
    (amount uint)
    (refund-address principal)
    (tx-hash (buff 32))
    (log-index uint))
    (err u0) ;; Not implemented
)

;; Public function to transfer ownership
(define-public (transfer-ownership (new-owner principal))
    (begin
        (asserts! (is-eq tx-sender (var-get contract-owner)) err-owner-only)
        (var-set contract-owner new-owner)
        (print {event: "OwnershipTransferred", newOwner: new-owner})
        (ok true)
    )
)

;; Read-only function to get the current balance
(define-read-only (get-balance)
    (ok (var-get contract-balance))
)

;; Read-only function to check if the caller is the contract owner
(define-read-only (is-contract-owner)
    (ok (is-eq tx-sender (var-get contract-owner)))
)

;; Read-only function to get the current contract owner
(define-read-only (get-contract-owner)
    (ok (var-get contract-owner))
)