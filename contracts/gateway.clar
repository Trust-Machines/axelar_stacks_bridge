(define-constant INVALID-SIGNERS-DATA (err u101))
(define-constant INVALID-SIGNERS (err u201))
(define-constant INVALID-SIGNER-WEIGHT (err u206))
(define-constant INVALID-SIGNER-ORDER (err u211))
(define-constant INVALID-SIGNERS-THRESHOLD (err u218))

(define-constant NULL-ADDRESS 'SP000000000000000000002Q6VF78)

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

;; helper function to get bytes of an account
(define-private (principal-to-bytes (p principal))  (get hash-bytes (unwrap-err-panic (principal-destruct? p))))

(define-private (get-signer-weight (signer {signer: principal, weight: uint})) (get weight signer))

(define-data-var prev-signer principal NULL-ADDRESS)

(define-private (reset-prev-signer) (var-set prev-signer NULL-ADDRESS))

(define-private (validate-signer (signer {signer: principal, weight: uint})) 
    (begin 
       (asserts! (> (get weight signer) u0) INVALID-SIGNER-WEIGHT)
       (asserts! (> (principal-to-bytes (get signer signer)) (principal-to-bytes (var-get prev-signer))) INVALID-SIGNER-ORDER)
       (var-set prev-signer (get signer signer))
       (ok true)
    )
)

(define-private (validate-signers (new-signers-data (buff 1024))) 
    (let
        (
            (new-signers (unwrap! (from-consensus-buff? { 
                signers: (list 32 {signer: principal, weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            } new-signers-data) INVALID-SIGNERS-DATA) )
            (signers (get signers new-signers))
            (threshold (get threshold new-signers))
            (total-weight (fold + (map get-signer-weight signers) u0))
        )
        (asserts! (> (len signers) u0)  INVALID-SIGNERS)
        (asserts! (> threshold u0) INVALID-SIGNERS-THRESHOLD)
        (asserts! (>= total-weight threshold) INVALID-SIGNERS-THRESHOLD)
        (map validate-signer signers)
        (reset-prev-signer)
        (ok u1)
    )
)