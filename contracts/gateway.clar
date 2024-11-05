(use-trait gateway-trait .traits.gateway-trait)

(define-public (call-contract
    (gateway-impl <gateway-trait>)
    (destination-chain (string-ascii 20))
    (destination-contract-address (string-ascii 128))
    (payload (buff 64000))
)
    (contract-call? gateway-impl call-contract destination-chain destination-contract-address payload)
)

;; ######################
;; ######################
;; ##### Messaging ######
;; ######################
;; ######################


(define-public (approve-messages
    (gateway-impl <gateway-trait>)
    (messages (buff 4096))
    (proof (buff 16384))
)
    (contract-call? gateway-impl approve-messages messages proof)
)

(define-public (validate-message
    (gateway-impl <gateway-trait>)
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload-hash (buff 32))
)
    (contract-call? gateway-impl validate-message source-chain message-id source-address payload-hash)
)




;; ####################
;; ####################
;; ### Operatorship ###
;; ####################
;; ####################


;; Transfers operatorship to a new account
(define-public (transfer-operatorship (gateway-impl <gateway-trait>) (new-operator principal))
    (contract-call? gateway-impl transfer-operatorship new-operator)
)

;; #########################
;; #########################
;; ### Weighted Multisig ###
;; #########################
;; #########################

;; Current signers epoch
(define-read-only (get-epoch) (contract-call? .gateway-storage get-epoch))

;; The timestamp for the last signer rotation
(define-read-only (get-last-rotation-timestamp) (contract-call? .gateway-storage get-last-rotation-timestamp))

;; The map of signer hash by epoch
(define-read-only (get-signer-hash-by-epoch (signer-epoch uint)) (contract-call? .gateway-storage get-signer-hash-by-epoch signer-epoch))

;; The map of epoch by signer hash
(define-read-only (get-epoch-by-signer-hash (signer-hash (buff 32))) (contract-call? .gateway-storage get-epoch-by-signer-hash signer-hash))

;; Previous signers retention. 0 means only the current signers are valid
(define-read-only (get-previous-signers-retention) (contract-call? .gateway-storage get-previous-signers-retention))

;; The domain separator for the signer proof
(define-read-only (get-domain-separator) (contract-call? .gateway-storage get-domain-separator))

;; The minimum delay required between rotations
(define-read-only (get-minimum-rotation-delay) (contract-call? .gateway-storage get-minimum-rotation-delay))


;; ##########################
;; ### Signers validation ###
;; ##########################




;; ############################
;; ### Signature validation ###
;; ############################






;; ########################
;; ### Proof validation ###
;; ########################




;; ########################
;; ### Signer rotation ####
;; ########################

(define-constant ERR-SIGNERS-DATA (err u5052))

(define-public (rotate-signers
    (gateway-impl <gateway-trait>)
    (new-signers (buff 8192))
    (proof (buff 16384))
)
    (contract-call? gateway-impl rotate-signers new-signers proof)
)


;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

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
