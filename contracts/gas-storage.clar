;; Error constants
(define-constant err-unauthorized (err u1000))

;; Data vars
(define-data-var owner principal tx-sender)
(define-data-var is-started bool false)

;; Check if caller is authorized (proxy or impl)
(define-private (is-authorized)
    (or
        (is-eq contract-caller .gas-service)
        (is-eq contract-caller .gas-impl)))

;; Owner management
(define-public (get-owner)
    (ok (var-get owner)))

(define-public (set-owner (new-owner principal))
    (begin
        (asserts! (is-authorized) err-unauthorized)
        (var-set owner new-owner)
        (ok true)))

;; Event emission functions
(define-public (emit-gas-paid-event 
    (sender principal)
    (amount uint)
    (refund-address principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload-hash (buff 32)))
    (begin
        (asserts! (is-authorized) err-unauthorized)
        (print {
            type: "native-gas-paid-for-contract-call",
            sender: sender,
            amount: amount,
            refund-address: refund-address,
            destination-chain: destination-chain,
            destination-address: destination-address,
            payload-hash: payload-hash
        })
        (ok true)))

(define-public (emit-gas-added-event
    (amount uint)
    (refund-address principal)
    (tx-hash (buff 32))
    (log-index uint))
    (begin
        (asserts! (is-authorized) err-unauthorized)
        (print {
            type: "native-gas-added",
            amount: amount,
            refund-address: refund-address,
            tx-hash: tx-hash,
            log-index: log-index
        })
        (ok true)))

(define-public (emit-refund-event
    (tx-hash (buff 32))
    (log-index uint)
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-authorized) err-unauthorized)
        (print {
            type: "refunded",
            tx-hash: tx-hash,
            log-index: log-index,
            receiver: receiver,
            amount: amount
        })
        (ok true)))

(define-public (emit-fees-collected-event
    (receiver principal)
    (amount uint))
    (begin
        (asserts! (is-authorized) err-unauthorized)
        (print {
            type: "fees-collected",
            receiver: receiver,
            amount: amount
        })
        (ok true)))

;; Started status management
(define-read-only (get-is-started)
    (var-get is-started))

(define-public (start)
    (begin
        (asserts! (is-authorized) err-unauthorized)
        (ok (var-set is-started true)))) 