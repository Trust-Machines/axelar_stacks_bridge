(define-constant NULL-ADDRESS 'SP000000000000000000002Q6VF78)

(define-constant ERR-ONLY-OPERATOR (err u20))
(define-constant ERR-SIGNERS-DATA (err u101))
(define-constant ERR-PROOF-DATA (err u106))
(define-constant ERR-SIGNERS-LEN (err u201))
(define-constant ERR-SIGNER-WEIGHT (err u206))
(define-constant ERR-SIGNER-ORDER (err u211))
(define-constant ERR-SIGNERS-THRESHOLD (err u218))
(define-constant ERR-SIGNERS-THRESHOLD-MISMATCH (err u223))
(define-constant ERR-INSUFFICIENT-ROTATION-DELAY (err u231))
(define-constant ERR-DUPLICATE-SIGNERS (err u261))

;; Operator
(define-data-var operator principal tx-sender)
(define-read-only (get-operator) (var-get operator))

;; Transfers operatorship to a new account
(define-public (transfer-operatorship (new-operator principal)) 
    (begin
        (asserts! (is-eq tx-sender (var-get operator)) ERR-ONLY-OPERATOR)
        (var-set operator new-operator)
        (print {action: "transfer-operatorship", new-operator: new-operator})
        (ok u1)
    )
)

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

;; A helper fn to get bytes of an account
(define-private (principal-to-bytes (p principal))  (get hash-bytes (unwrap-err-panic (principal-destruct? p))))

;; A helper var to allow comparison while validating a signer
(define-data-var prev-signer principal NULL-ADDRESS)

;; Helper fn to reset prev-signer as NULL-ADDRESS
(define-private (reset-prev-signer) (var-set prev-signer NULL-ADDRESS))

;; Returns weight of a signer
(define-private (get-signer-weight (signer {signer: principal, weight: uint})) (get weight signer))

;; Validates a particular signer
(define-private (validate-signer (signer {signer: principal, weight: uint})) 
    (begin 
       (asserts! (> (get weight signer) u0) ERR-SIGNER-WEIGHT)
       ;; signers need to be in strictly increasing order
       (asserts! (> (principal-to-bytes (get signer signer)) (principal-to-bytes (var-get prev-signer))) ERR-SIGNER-ORDER)
       (var-set prev-signer (get signer signer))
       (ok true)
    )
)

;; This function checks if the provided signers are valid
(define-private (validate-signers (new-signers { 
                signers: (list 32 {signer: principal, weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            })) 
    (let
        (
            (signers (get signers new-signers))
            (threshold (get threshold new-signers))
            (total-weight (fold + (map get-signer-weight signers) u0))
        )
        (asserts! (> (len signers) u0) ERR-SIGNERS-LEN)
        (asserts! (> threshold u0) ERR-SIGNERS-THRESHOLD)
        (asserts! (>= total-weight threshold) ERR-SIGNERS-THRESHOLD-MISMATCH)
        (map validate-signer signers)
        (reset-prev-signer)
        (ok u1)
    )
)

;; Updates the last rotation timestamp, and enforces the minimum rotation delay if specified
(define-private (update-rotation-timestamp (enforce-rotation-delay bool)) 
    (let   
        (
            (last-rotation-timestamp_ (var-get last-rotation-timestamp))
            (current-ts (unwrap-panic (get-block-info? time block-height)))
        )
        (and enforce-rotation-delay (< (- current-ts last-rotation-timestamp_) (var-get minimum-rotation-delay)) (asserts! (is-eq 0 1) ERR-INSUFFICIENT-ROTATION-DELAY))
        (var-set last-rotation-timestamp current-ts)
        (ok u1)
    )
)

(define-private (rotate-signers-inner (new-signers-data (buff 1024)) (enforce-rotation-delay bool)) 
    (let 
        (
            (new-signers (unwrap! (from-consensus-buff? { 
                signers: (list 32 {signer: principal, weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            } new-signers-data) ERR-SIGNERS-DATA))
            (new-signers-hash (keccak256 new-signers-data))
            (new-epoch (+ (var-get epoch) u1))
        )
        (asserts! (is-none (map-get? epoch-by-signer-hash new-signers-hash)) ERR-DUPLICATE-SIGNERS)
        (try! (validate-signers new-signers))
        (try! (update-rotation-timestamp enforce-rotation-delay))
        (var-set epoch new-epoch)
        (map-set signer-hash-by-epoch new-epoch new-signers-hash)
        (map-set epoch-by-signer-hash new-signers-hash new-epoch)
        (print {action: "rotate-signers", new-epoch: new-epoch, new-signers-hash: new-signers-hash, new-signers-data: new-signers-data})
        (ok u1)
    )
)

(define-public (rotate-signers (new-signers-data (buff 1024)) (proof-data (buff 1024))) 
    (let 
        (
            (new-signers (unwrap! (from-consensus-buff? { 
                signers: (list 32 {signer: principal, weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            } new-signers-data) ERR-SIGNERS-DATA))
             (proof (unwrap! (from-consensus-buff? { 
                weighted-signers: {
                    signers: (list 32 {signer: principal, weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                },
                signatures: (list 32 (buff 64))
            } new-signers-data) ERR-PROOF-DATA))
            (data-hash (keccak256 (unwrap-panic (to-consensus-buff? (merge new-signers { type: "rotate-signers"})))))
            (enforce-rotation-delay (not (is-eq tx-sender (var-get operator))))
        )
        ;; TODO: _validateProof
        (try! (rotate-signers-inner new-signers-data enforce-rotation-delay))
        (ok u1)
    )
)