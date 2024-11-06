(use-trait gateway-trait .traits.gateway-trait)

;; ######################
;; ######################
;; ### Proxy Calls ######
;; ######################
;; ######################

(define-constant ERR-INVALID-IMPL (err u10211))

(define-private (is-correct-impl (gateway-impl <gateway-trait>)) (is-eq (contract-call? .gateway-storage get-impl) (contract-of gateway-impl)))

(define-public (call-contract
    (gateway-impl <gateway-trait>)
    (destination-chain (string-ascii 20))
    (destination-contract-address (string-ascii 128))
    (payload (buff 64000))
)
    (begin 
        (asserts! (is-eq (is-correct-impl gateway-impl) true) ERR-INVALID-IMPL)
        (contract-call? gateway-impl call-contract destination-chain destination-contract-address payload)
    )
)

(define-public (approve-messages
    (gateway-impl <gateway-trait>)
    (messages (buff 4096))
    (proof (buff 16384))
)
    (begin
        (asserts! (is-eq (is-correct-impl gateway-impl) true) ERR-INVALID-IMPL)
        (contract-call? gateway-impl approve-messages messages proof)
    )
)

(define-public (validate-message
    (gateway-impl <gateway-trait>)
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload-hash (buff 32))
)
    (begin
        (asserts! (is-eq (is-correct-impl gateway-impl) true) ERR-INVALID-IMPL)
        (contract-call? gateway-impl validate-message source-chain message-id source-address payload-hash)
    )
)

(define-public (rotate-signers
    (gateway-impl <gateway-trait>)
    (new-signers (buff 8192))
    (proof (buff 16384))
)
    (begin
        (asserts! (is-eq (is-correct-impl gateway-impl) true) ERR-INVALID-IMPL)
        (contract-call? gateway-impl rotate-signers new-signers proof)
    )
)

(define-public (transfer-operatorship (gateway-impl <gateway-trait>) (new-operator principal))
    (begin
        (asserts! (is-eq (is-correct-impl gateway-impl) true) ERR-INVALID-IMPL)
        (contract-call? gateway-impl transfer-operatorship new-operator)
    )
)

;; General purose proxy call 
(define-public (call (gateway-impl <gateway-trait>) (fn (string-ascii 32)) (data (buff 65000))) 
    (begin 
        (asserts! (is-eq (is-correct-impl gateway-impl) true) ERR-INVALID-IMPL)
        (contract-call? gateway-impl dispatch fn data)
    )
)

;; ######################
;; ######################
;; ### Upgradability ####
;; ######################
;; ######################

(define-constant GOVERNANCE .governance)

(define-constant ERR-UNAUTHORIZED (err u10111))

(define-public (updgrade-impl (gateway-impl <gateway-trait>))
    (let
        (
            (prev (contract-call? .gateway-storage get-impl))
            (new (contract-of gateway-impl))
        ) 
        (asserts! (is-eq contract-caller GOVERNANCE) ERR-UNAUTHORIZED)
        (try! (contract-call? .gateway-storage set-impl new))
        (print {
            type: "gateway-impl-updgraded",
            prev: prev,
            new: new
        })
        (ok true)
    )
)

;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

(define-constant ERR-SIGNERS-DATA (err u5052))
(define-constant ERR-STARTED (err u6051))

;; Constructor function
;; @param signers; The data for the new signers.
;; @param operator_
;; @previous-signers-retention_
;; @domain-separator_
;; @minimum-rotation-delay_
;; @returns (response true) or reverts
(define-public (setup
    (signers (buff 8192))
    (operator_ principal)
    (domain-separator_ (buff 32))
    (minimum-rotation-delay_ uint)
    (previous-signers-retention_ uint)
)
    (let
        (
            (signers_ (unwrap! (from-consensus-buff? {
                signers: (list 100 {signer: (buff 33), weight: uint}),
                threshold: uint,
                nonce: (buff 32)
            } signers) ERR-SIGNERS-DATA))
        )
        (asserts! (is-eq (contract-call? .gateway-storage get-is-started) false) ERR-STARTED)
        (try! (contract-call? .gateway-impl rotate-signers-inner signers_ false))
        (try! (contract-call? .gateway-storage set-operator operator_))
        (try! (contract-call? .gateway-storage set-domain-separator domain-separator_))
        (try! (contract-call? .gateway-storage set-minimum-rotation-delay minimum-rotation-delay_))
        (try! (contract-call? .gateway-storage set-previous-signers-retention previous-signers-retention_))
        (try! (contract-call? .gateway-storage start))
        (ok true)
    )
)
