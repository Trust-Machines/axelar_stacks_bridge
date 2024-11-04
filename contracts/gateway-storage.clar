(define-data-var gateway principal .gateway)

(define-data-var operator principal contract-caller)

(define-read-only (get-operator) (var-get operator))

(define-public (set-operator (new-operator principal)) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (var-set operator new-operator)
        (ok true)
    )
)


(define-data-var epoch uint u0)

(define-read-only (get-epoch) (var-get epoch))

(define-public (set-epoch (new-epoch uint)) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (var-set epoch new-epoch)
        (ok true)
    )
)
