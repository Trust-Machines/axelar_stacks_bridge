

;; Current signers epoch
(define-data-var epoch uint u0)
(define-read-only (get-epoch) (var-get epoch))

;; The timestamp for the last signer rotation
(define-data-var last-rotation-timestamp uint u0)
(define-read-only (get-last-rotation-timestamp) (var-get last-rotation-timestamp))

;; The map of signer hash by epoch
(define-map signer-hash-by-epoch uint (buff 256))
(define-read-only (get-signer-hash-by-epoch (signer-epoch uint)) (map-get? signer-hash-by-epoch signer-epoch))

;; The map of epoch by signer hash
(define-map epoch-by-signer-hash (buff 256) uint)
(define-read-only (get-epoch-by-signer-hash (signer-hash (buff 256))) (map-get? epoch-by-signer-hash signer-hash))

;; Previous signers retention. 0 means only the current signers are valid
(define-data-var previous-signers-retention uint u0)
(define-read-only (get-previous-signers-retention) (var-get previous-signers-retention))

;; The domain separator for the signer proof
(define-data-var domain-separator (buff 24) 0x)
(define-read-only (get-domain-separator) (var-get domain-separator))

;; The minimum delay required between rotations
(define-data-var minimum-rotation-delay uint u0)
(define-read-only (get-minimum-rotation-delay) (var-get minimum-rotation-delay))

