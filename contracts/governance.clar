(use-trait gateway-trait .traits.gateway-trait)

;; ######################
;; ######################
;; ###### Timelock ######
;; ######################
;; ######################

(define-constant ERR-TIMELOCK-EXISTS (err u12001))
(define-constant ERR-TIMELOCK-NOT-READY (err u12011))
(define-constant ERR-TIMELOCK-HASH (err u12021))

(define-constant MIN-TIMELOCK-DELAY u43200) ;; 12 hours

(define-map timelock-map (buff 32) uint)

;; Returns the timestamp after which the timelock may be executed.
;; @params hash; The hash of the timelock
;; @returns uint
(define-read-only (get-timelock (hash (buff 32))) (default-to u0 (map-get? timelock-map hash)))

;; Schedules a new timelock.
;; The timestamp will be set to the current block timestamp + minimum time delay, 
;; if the provided timestamp is less than that.
;; @params hash; The hash of the new timelock
;; @params eta; The proposed Unix timestamp (in secs) after which the new timelock can be executed
;; @returns (response true) or reverts
(define-private (schedule-timelock (hash (buff 32)) (eta uint)) 
    (let 
        (
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
            (min-eta (+ current-ts MIN-TIMELOCK-DELAY))
            (eta- (if (< eta min-eta) min-eta eta))
        ) 
        (asserts! (is-eq (get-timelock hash) u0) ERR-TIMELOCK-EXISTS)
        (ok (map-set timelock-map hash eta-))
    )
)

;; Cancels an existing timelock by setting its eta to zero.
;; @params hash; The hash of the timelock to cancel
;; @returns (response true) or reverts
(define-private (cancel-timelock (hash (buff 32))) 
    (let
        (
            (eta (get-timelock hash))
        )
        (asserts! (> eta u0) ERR-TIMELOCK-HASH)
        (ok (map-set timelock-map hash u0))
    )
)

;; Finalizes an existing timelock and sets its eta back to zero.
;; To finalize, the timelock must currently exist and the required time delay must have passed.
;; @params hash; The hash of the timelock to finalize
;; @returns (response true) or reverts
(define-private (finalize-timelock (hash (buff 32))) 
    (let
        (
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
            (eta (get-timelock hash))
        )
        (asserts! (> eta u0) ERR-TIMELOCK-HASH)
        (asserts! (>= current-ts eta) ERR-TIMELOCK-NOT-READY)
        (ok (map-set timelock-map hash u0))
    )
)


(define-constant ERR-PAYLOAD-DATA (err u13021))

(define-public (set-gateway-impl
    (gateway-impl <gateway-trait>)
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload (buff 64000))
)
    (let
        (
            (command-id (contract-call? .gateway-impl message-to-command-id source-chain message-id))
            (data (unwrap! (from-consensus-buff? {
                target: principal,
                eta: uint
            } payload) ERR-PAYLOAD-DATA))
            (payload-hash (keccak256 payload))
        )
        (try! (contract-call? .gateway validate-message gateway-impl source-chain message-id source-address (keccak256 payload)))
        (ok (schedule-timelock payload-hash (get eta data)))
    )
)

