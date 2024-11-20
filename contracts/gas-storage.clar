(define-constant PROXY .gas-service)

(define-constant ERR-UNAUTHORIZED (err u10111))

(define-private (is-proxy-or-impl) (or (is-eq contract-caller PROXY) (is-eq contract-caller (var-get impl))))

(define-private (is-proxy) (is-eq contract-caller PROXY))

(define-private (is-impl) (is-eq contract-caller (var-get impl)))

;; ######################
;; ######################
;; ####### Storage ######
;; ######################
;; ######################

;; Constructor flag
(define-data-var is-started bool false)

(define-read-only (get-is-started) (var-get is-started))

(define-public (start) 
    (begin
        (asserts! (is-proxy) ERR-UNAUTHORIZED)
        (ok (var-set is-started true))
    )
)

;; Gas Service implementation contract address 
(define-data-var impl principal .gas-impl)

(define-read-only (get-impl) (var-get impl))

(define-public (set-impl (new-impl principal)) 
    (begin
        (asserts! (is-proxy) ERR-UNAUTHORIZED)
        (ok (var-set impl new-impl))
    )
)

;; ######################
;; ######################
;; ####### Events #######
;; ######################
;; ######################
(define-public (emit-gas-paid-event 
    (sender principal)
    (amount uint)
    (refund-address principal)
    (destination-chain (string-ascii 20))
    (destination-address (string-ascii 128))
    (payload-hash (buff 32)))
    (begin
        (asserts! (is-impl) ERR-UNAUTHORIZED)
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
        (asserts! (is-impl) ERR-UNAUTHORIZED)
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
        (asserts! (is-impl) ERR-UNAUTHORIZED)
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
        (asserts! (is-impl) ERR-UNAUTHORIZED)
        (print {
            type: "fees-collected",
            receiver: receiver,
            amount: amount
        })
        (ok true)))