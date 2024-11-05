(use-trait gateway-trait .traits.gateway-trait)

(define-constant NULL-PUB 0x00)

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

(define-constant ERR-MESSAGES-DATA (err u9051))
(define-constant ERR-MESSAGE-NOT-FOUND (err u9052))
(define-constant MESSAGE-EXECUTED 0x01)


;; Compute the command-id for a message.
;; @param source-chain The name of the source chain as registered on Axelar.
;; @param message-id The unique message id for the message.
;; @returns (buff 32) the command-id.
(define-read-only (message-to-command-id (source-chain (string-ascii 20)) (message-id (string-ascii 128)))
    ;; Axelar doesn't allow `sourceChain` to contain '_', hence this encoding is umambiguous
    (keccak256 (unwrap-panic (to-consensus-buff? (concat (concat source-chain "_") message-id)))))


;; For backwards compatibility with `validateContractCall`, `commandId` is used here instead of `messageId`.
;; @returns (buff 32) the message hash
(define-private (get-message-hash (message {
        message-id: (string-ascii 128),
        source-chain: (string-ascii 20),
        source-address: (string-ascii 128),
        contract-address: principal,
        payload-hash: (buff 32)
    }))
    (keccak256 (unwrap-panic (to-consensus-buff? message)))
)




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

;; Checks if a message is approved.
;; Determines whether a given message, identified by the source-chain and message-id, is approved.
;; @param source-chain; The name of the source chain.
;; @param message-id; The unique identifier of the message.
;; @param source-address; The address of the sender on the source chain.
;; @param contract-address; The address of the contract where the call will be executed.
;; @param payload-hash; The keccak256 hash of the payload data.
;; @returns (response bool)
(define-read-only (is-message-approved
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (contract-address principal)
    (payload-hash (buff 32))
)
    (let (
            (command-id (message-to-command-id source-chain message-id))
            (message-hash (get-message-hash {
                message-id: message-id,
                source-chain: source-chain,
                source-address: source-address,
                contract-address: contract-address,
                payload-hash: payload-hash
            }))
        )
        (ok (is-eq message-hash (get-message command-id))))
)

;; Checks if a message is executed.
;; Determines whether a given message, identified by the source-chain and message-id is executed.
;; @param source-chain; The name of the source chain.
;; @param message-id; The unique identifier of the message.
;; @returns (response bool)
(define-read-only (is-message-executed
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
)
    (ok (is-eq MESSAGE-EXECUTED (get-message (message-to-command-id source-chain message-id))))
)

;; Message getter with the command-id. Returns an empty buffer if no message matched.
;; @param command-id
;; @returns (buff 32) or (buff 1)
(define-read-only (get-message
    (command-id (buff 32))
)
    (default-to 0x00 (contract-call? .gateway-storage get-message command-id))
)

;; ####################
;; ####################
;; ### Operatorship ###
;; ####################
;; ####################

(define-constant ERR-ONLY-OPERATOR (err u1051))

(define-read-only (get-operator) (contract-call? .gateway-storage get-operator))

;; Transfers operatorship to a new account
(define-public (transfer-operatorship (new-operator principal))
    (begin
        (asserts! (is-eq (get-is-started) true) ERR-NOT-STARTED)
        (asserts! (is-eq contract-caller (get-operator)) ERR-ONLY-OPERATOR)
        (try! (contract-call? .gateway-storage set-operator new-operator))
        (print {type: "transfer-operatorship", new-operator: new-operator})
        (ok true)
    )
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

;; Helper vars to use within loops
(define-data-var temp-pub (buff 33) NULL-PUB)
(define-data-var temp-hash (buff 32) 0x00)
(define-data-var temp-signers (list 100 {signer: (buff 33), weight: uint}) (list))

;; Compute the message hash that is signed by the weighted signers
;; Returns an Stacks Signed Message, created from `domain-separator`, `signers-hash`, and `data-hash`.
;; @param signers-hash; The hash of the weighted signers that sign off on the data
;; @param data-hash; The hash of the data
;; @returns (buff 32); The message hash to be signed
(define-read-only (message-hash-to-sign (signers-hash (buff 32)) (data-hash (buff 32)))
    (keccak256
        (concat
            (unwrap-panic (to-consensus-buff? "Stacks Signed Message"))
            (concat
                (get-domain-separator)
                (concat
                    signers-hash
                    data-hash
                )
            )
        )
    )
)

;; Helper function to build keccak256 data-hash from signers
;; @param signers;
;; @returns (response (buff 32))
(define-read-only (data-hash-from-signers (signers {
                signers: (list 100 {signer: (buff 33), weight: uint}),
                threshold: uint,
                nonce: (buff 32)
            })
)
    (keccak256 (unwrap-panic (to-consensus-buff? (merge {data: signers} { type: "rotate-signers" }))))
)

;; Helper function to build keccak256 of signers
;; @param signers;
;; @returns (response (buff 32))
(define-read-only (get-signers-hash (signers {
                signers: (list 100 {signer: (buff 33), weight: uint}),
                threshold: uint,
                nonce: (buff 32)
            })
)
    (keccak256 (unwrap-panic (to-consensus-buff? signers)))
)


;; ##########################
;; ### Signers validation ###
;; ##########################

(define-constant ERR-SIGNERS-LEN (err u2051))
(define-constant ERR-SIGNER-WEIGHT (err u2053))
(define-constant ERR-SIGNERS-ORDER (err u2054))
(define-constant ERR-SIGNERS-THRESHOLD (err u2055))
(define-constant ERR-SIGNERS-THRESHOLD-MISMATCH (err u2056))


;; ############################
;; ### Signature validation ###
;; ############################

(define-constant ERR-INVALID-SIGNATURE-DATA (err u3051))
(define-constant ERR-SIGNATURES-NO-MATCH (err u3053))
(define-constant ERR-LOW-SIGNATURES-WEIGHT (err u3055))


;; ########################
;; ### Proof validation ###
;; ########################

(define-constant ERR-INVALID-SIGNERS (err u4051))


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
(define-constant ERR-NOT-STARTED (err u6052))

(define-read-only (get-is-started) (contract-call? .gateway-storage get-is-started))

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
        (asserts! (is-eq (get-is-started) false) ERR-STARTED)
        (try! (contract-call? .gateway-impl rotate-signers-inner signers_ false))
        (try! (contract-call? .gateway-storage set-operator operator_))
        (try! (contract-call? .gateway-storage set-domain-separator domain-separator_))
        (try! (contract-call? .gateway-storage set-minimum-rotation-delay minimum-rotation-delay_))
        (try! (contract-call? .gateway-storage set-previous-signers-retention previous-signers-retention_))
        (try! (contract-call? .gateway-storage start))
        (ok true)
    )
)
