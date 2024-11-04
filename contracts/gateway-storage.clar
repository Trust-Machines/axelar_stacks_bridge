(define-data-var gateway principal .gateway)

(define-data-var operator principal contract-caller)

(define-read-only (get-operator) (var-get operator))

(define-public (set-operator (new-operator principal)) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (var-set operator new-operator))
    )
)

;; Current signers epoch
(define-data-var epoch uint u0)

(define-read-only (get-epoch) (var-get epoch))

(define-public (set-epoch (epoch- uint)) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (var-set epoch epoch-))
    )
)

;; The timestamp for the last signer rotation
(define-data-var last-rotation-timestamp uint u0)

(define-read-only (get-last-rotation-timestamp) (var-get last-rotation-timestamp))

(define-public (set-last-rotation-timestamp (new-timestamp uint)) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (var-set last-rotation-timestamp new-timestamp))
    )
)

;; The map of signer hash by epoch
(define-map signer-hash-by-epoch uint (buff 32))

(define-read-only (get-signer-hash-by-epoch (signer-epoch uint)) (map-get? signer-hash-by-epoch signer-epoch))

(define-public (set-signer-hash-by-epoch (epoch- uint) (signers-hash (buff 32))) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (map-set signer-hash-by-epoch epoch- signers-hash))
    )
)

;; The map of epoch by signer hash
(define-map epoch-by-signer-hash (buff 32) uint)

(define-read-only (get-epoch-by-signer-hash (signer-hash (buff 32))) (map-get? epoch-by-signer-hash signer-hash))

(define-public (set-epoch-by-signer-hash (signers-hash (buff 32)) (epoch- uint) ) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (map-set epoch-by-signer-hash signers-hash epoch-))
    )
)

;; Previous signers retention. 0 means only the current signers are valid
(define-data-var previous-signers-retention uint u0)

(define-read-only (get-previous-signers-retention) (var-get previous-signers-retention))

(define-public (set-previous-signers-retention (retention uint)) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (var-set previous-signers-retention retention))
    )
)

;; The domain separator for the signer proof
(define-data-var domain-separator (buff 32) 0x00)

(define-read-only (get-domain-separator) (var-get domain-separator))

(define-public (set-domain-separator (separator (buff 32))) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (var-set domain-separator separator))
    )
)


;; The minimum delay required between rotations
(define-data-var minimum-rotation-delay uint u0)

(define-read-only (get-minimum-rotation-delay) (var-get minimum-rotation-delay))

(define-public (set-minimum-rotation-delay (delay uint)) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (var-set minimum-rotation-delay delay))
    )
)

;; Messages map
(define-map messages (buff 32) (buff 32))

(define-read-only (get-message (command-id (buff 32))) (map-get? messages command-id))

(define-public (insert-message (command-id (buff 32)) (message-hash (buff 32)) ) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (map-insert messages command-id message-hash))
    )
)

(define-public (set-message (command-id (buff 32)) (message-hash (buff 32)) ) 
    (begin
        (asserts! (is-eq u1 u1) (err u321)) ;; TODO: validate if the gateway or impl
        (ok (map-set messages command-id message-hash))
    )
)