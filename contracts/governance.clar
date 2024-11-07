(use-trait gateway-trait .traits.gateway-trait)

(define-constant MIN-TIMELOCK-DELAY u3600) ;; 1 hour

(define-map timelock-map (buff 32) uint)

(define-read-only (get-timelock (hash (buff 32))) (default-to u0 (map-get? timelock-map hash)))

(define-private (schedule-timelock (hash (buff 32)) (eta uint)) 
    (let 
        (
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
            (min-eta (+ current-ts MIN-TIMELOCK-DELAY))
            (eta- (if (< eta min-eta) min-eta eta))
        ) 
        (asserts! (is-eq (get-timelock hash) u0) (err u5432))
        (ok (map-set timelock-map hash eta-))
    )
)

(define-private (cancel-timelock (hash (buff 32))) 
     (ok (map-set timelock-map hash u0))
)

(define-private (finalize-timelock (hash (buff 32))) 
    (let
        (
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
            (eta (get-timelock hash))
        )
        (asserts! (> eta u0) (err u5437))
        (asserts! (>= current-ts eta) (err u5441))
        (ok (map-set timelock-map hash u0))
    )
)

(define-private (execute-inner
        (command-id (buff 32))
        (source-chain (string-ascii 20))
        (source-address (string-ascii 128))
        (payload (buff 64000))
) 
    (ok true)
)


(define-public (execute
    (gateway-impl <gateway-trait>)
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload (buff 64000))
)
    (let
        (
            (command-id (contract-call? .gateway-impl message-to-command-id source-chain message-id))
        )
        (try! (contract-call? .gateway validate-message gateway-impl source-chain message-id source-address (keccak256 payload)))
        (execute-inner command-id source-chain source-address payload)
    )
)