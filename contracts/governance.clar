(use-trait gateway-trait .traits.gateway-trait)
(use-trait proxy-trait .traits.proxy-trait)

(define-constant NULL-ADDRESS (unwrap-panic (principal-construct? (if (is-eq chain-id u1) 0x16 0x1a) 0x0000000000000000000000000000000000000000)))

;; ######################
;; ######################
;; ###### Timelock ######
;; ######################
;; ######################

(define-constant ERR-TIMELOCK-EXISTS (err u12001))
(define-constant ERR-TIMELOCK-NOT-READY (err u12011))
(define-constant ERR-TIMELOCK-HASH (err u12021))
(define-constant ERR-TIMELOCK-MIN-ETA (err u12031))

(define-constant MIN-TIMELOCK-DELAY u43200) ;; 12 hours

(define-map timelock-map (buff 32) {target: principal, eta: uint, type: uint})

;; Returns the timestamp after which the timelock may be executed.
;; @params hash; The hash of the timelock
;; @returns uint
(define-read-only (get-timelock (hash (buff 32))) (default-to {target: NULL-ADDRESS, eta: u0, type: u0} (map-get? timelock-map hash)))

;; Schedules a new timelock.
;; The timestamp will be set to the current block timestamp + minimum time delay, if the provided timestamp is less than that.
;; @params hash; The hash of the new timelock.
;; @params target; The target principal address to be interacted with.
;; @params eta; The proposed Unix timestamp (in secs) after which the new timelock can be executed.
;; @params type; Task type.
;; @returns (response true) or reverts
(define-private (schedule-timelock (hash (buff 32)) (target principal) (eta uint) (type uint)) 
    (let 
        (
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
            (min-eta (+ current-ts MIN-TIMELOCK-DELAY))
        ) 
        (asserts! (is-eq (get eta (get-timelock hash)) u0) ERR-TIMELOCK-EXISTS)
        (asserts! (>= eta min-eta) ERR-TIMELOCK-MIN-ETA)
        (ok (map-set timelock-map hash {target: target, eta: eta, type: type}))
    )
)

;; Cancels an existing timelock by setting its eta to zero.
;; @params hash; The hash of the timelock to cancel
;; @returns (response true) or reverts
(define-private (cancel-timelock (hash (buff 32))) 
    (let
        (
            (eta (get eta (get-timelock hash)))
        )
        (asserts! (> eta u0) ERR-TIMELOCK-HASH)
        (ok (map-delete timelock-map hash))
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
            (eta (get eta (get-timelock hash)))
        )
        (asserts! (> eta u0) ERR-TIMELOCK-HASH)
        (asserts! (>= current-ts eta) ERR-TIMELOCK-NOT-READY)
        (ok (map-delete timelock-map hash))
    )
)

;; ######################
;; ######################
;; ##### Governance #####
;; ######################
;; ######################

(define-constant ERR-PAYLOAD-DATA (err u13021))
(define-constant ERR-INVALID-TYPE (err u13041))

;; Schedules a new task
;; @gateway-impl; Trait reference of the current gateway implementation. 
;; @param source-chain; The name of the source chain.
;; @param message-id; The unique identifier of the message.
;; @param source-address; The address of the sender on the source chain.
;; @param payload; The payload that contains the new impl address and eta.
;; @returns (response true) or reverts
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
            (data (unwrap! (from-consensus-buff? {
                target: principal,
                eta: uint,
                type: uint
            } payload) ERR-PAYLOAD-DATA))
            (payload-hash (keccak256 payload))
        )
        (try! (contract-call? .gateway validate-message gateway-impl source-chain message-id source-address payload-hash))
        (schedule-timelock payload-hash (get target data) (get eta data) (get type data))
    )
)

;; Finalizes a scheduled task
;; @proxy; Proxy trait reference to run task with. 
;; @payload-hash; Hash to find the scheduled task. This is the hash passed while scheduling the task.
;; @returns (response true) or reverts
(define-public (finalize
    (proxy <proxy-trait>)
    (payload (buff 64000))
)
    (let
        (
            (payload-hash (keccak256 payload))
            (timelock (get-timelock payload-hash))
            (target (get target timelock))
            (type (get type timelock))
        )
        (try! (finalize-timelock payload-hash))
        (asserts! (is-eq
            (if (is-eq type u1) 
                (begin 
                    (try! (contract-call? proxy set-impl target))
                    true
                 )
                (if (is-eq type u2) 
                    (begin 
                        (try! (contract-call? proxy set-governance target))
                        true
                    )
                    false
            )
        ) true) ERR-INVALID-TYPE)
        (ok true)
    )
)

;; Cancels a scheduled task
;; @gateway-impl; Trait reference of the current gateway implementation. 
;; @param source-chain; The name of the source chain.
;; @param message-id; The unique identifier of the message.
;; @param source-address; The address of the sender on the source chain.
;; @param payload; The payload that contains the new impl address and eta.
;; @returns (response true) or reverts
(define-public (cancel
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
                hash: (buff 32),
                type: uint
            } payload) ERR-PAYLOAD-DATA))
        )
        (asserts! (is-eq (get type data) u3) ERR-INVALID-TYPE)
        (try! (contract-call? .gateway validate-message gateway-impl source-chain message-id source-address (keccak256 payload)))
        (cancel-timelock (get hash data))
    )
)