(impl-trait .traits.gateway-trait)

(define-constant NULL-PUB 0x00)

(define-constant proxy .gateway)

(define-read-only (is-proxy) (is-eq contract-caller proxy))

(define-read-only (get-is-started) (contract-call? .gateway-storage get-is-started))

(define-constant ERR-NOT-STARTED (err u6052))
(define-constant ERR-UNAUTHORIZED (err u10111))

;; Sends a message to the specified destination chain and address with a given payload.
;; This function is the entry point for general message passing between chains.
;; @param destination-chain; The chain where the destination contract exists. A registered chain name on Axelar must be used here
;; @param destination-contract-address; The address of the contract to call on the destination chain
;; @param payload; The payload to be sent to the destination contract, usually representing an encoded function call with arguments
(define-public (call-contract
    (destination-chain (string-ascii 20))
    (destination-contract-address (string-ascii 128))
    (payload (buff 64000))
)
    (begin
        (asserts! (is-eq (is-proxy) true) ERR-UNAUTHORIZED)
        (asserts! (is-eq (get-is-started) true) ERR-NOT-STARTED)
        (try! (contract-call? .gateway-storage emit-contract-call tx-sender destination-chain destination-contract-address payload (keccak256 payload)))
        (ok true)
    )
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

;; Helper function to build keccak256 data-hash from messages
;; @param messages;
;; @returns (response (buff 32))
(define-read-only (data-hash-from-messages (messages (list 10 {
                source-chain: (string-ascii 20),
                message-id: (string-ascii 128),
                source-address: (string-ascii 128),
                contract-address: principal,
                payload-hash: (buff 32)
        })))
    (keccak256 (unwrap-panic (to-consensus-buff? (merge {data: messages} { type: "approve-messages" }))))
)

;; Approves a message if it hasn't been approved before. The message status is set to approved.
;; @params message;
;; @returns (some message) or none
(define-private (approve-message (message {
                source-chain: (string-ascii 20),
                message-id: (string-ascii 128),
                source-address: (string-ascii 128),
                contract-address: principal,
                payload-hash: (buff 32)
            }))
            (let (
                    (command-id (message-to-command-id (get source-chain message) (get message-id message)))
                    (inserted (unwrap-panic (contract-call? .gateway-storage insert-message command-id (get-message-hash {
                        message-id: (get message-id message),
                        source-chain: (get source-chain message),
                        source-address: (get source-address message),
                        contract-address: (get contract-address message),
                        payload-hash: (get payload-hash message)
                    }))))
                )
                (if
                    inserted
                    (some (contract-call? .gateway-storage emit-message-approved command-id message))
                    none)))


;; @notice Approves an array of messages, signed by the Axelar signers.
;; @param messages; The list of messages to verify.
;; @param proof; The proof signed by the Axelar signers for this command.
;; @returns (response true) or err
(define-public (approve-messages
    (messages (buff 4096))
    (proof (buff 16384)))
    (let (
        (proof_ (unwrap! (from-consensus-buff? {
                signers: {
                    signers: (list 100 {signer: (buff 33), weight: uint}),
                    threshold: uint,
                    nonce: (buff 32)
                },
                signatures: (list 100 (buff 65))
            } proof) ERR-SIGNERS-DATA))
        (messages_ (unwrap! (from-consensus-buff?
            (list 10 {
                source-chain: (string-ascii 20),
                message-id: (string-ascii 128),
                source-address: (string-ascii 128),
                contract-address: principal,
                payload-hash: (buff 32)
            })
            messages) ERR-MESSAGES-DATA))
             (data-hash (data-hash-from-messages messages_)
        ))
        (asserts! (is-eq (is-proxy) true) ERR-UNAUTHORIZED)
        (asserts! (is-eq (get-is-started) true) ERR-NOT-STARTED)
        (try! (validate-proof data-hash proof_))
        (map approve-message messages_)
        (ok true)
    )
)

;; Validates if a message is approved. If message was in approved status, status is updated to executed to avoid replay.
;; @param source-chain; The name of the source chain.
;; @param message-id; The unique identifier of the message.
;; @param source-address; The address of the sender on the source chain.
;; @param payload-hash The keccak256 hash of the payload data.
;; @returns (response true) or reverts
(define-public (validate-message
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload-hash (buff 32))
)
    (let (
        (command-id (message-to-command-id source-chain message-id))
        (message-hash (get-message-hash {
                message-id: message-id,
                source-chain: source-chain,
                source-address: source-address,
                contract-address: tx-sender,
                payload-hash: payload-hash
            }))
    )
        (asserts! (is-eq (is-proxy) true) ERR-UNAUTHORIZED)
        (asserts! (is-eq (get-is-started) true) ERR-NOT-STARTED)
        (asserts! (is-eq (get-message command-id) message-hash) ERR-MESSAGE-NOT-FOUND)
        (try! (contract-call? .gateway-storage set-message command-id MESSAGE-EXECUTED))
        (try! (contract-call? .gateway-storage emit-message-executed command-id source-chain message-id))
        (ok true)
    )
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
        (asserts! (is-eq (is-proxy) true) ERR-UNAUTHORIZED)
        (asserts! (is-eq (get-is-started) true) ERR-NOT-STARTED)
        (asserts! (is-eq tx-sender (get-operator)) ERR-ONLY-OPERATOR)
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

;; Returns weight of a signer
;; @param signer; Signer to validate
;; @returns uint
(define-private (get-signer-weight (signer {signer: (buff 33), weight: uint})) (get weight signer))

;; Validates a particular signer's weight
;; @param signer; Signer to validate
;; @returns bool
(define-private (validate-signer-weight (signer {signer: (buff 33), weight: uint}))
    (> (get weight signer) u0) ;; signer weight must be bigger than zero
)

;; Validates signer order
;; @param signer; Signer to validate
;; @returns (response true) or reverts
(define-private (validate-signer-order (signer {signer: (buff 33), weight: uint}))
    (let
        (
            (r (> (get signer signer) (var-get temp-pub)))
        )
       ;; save this signer in order to do comparison with the next signer
       (var-set temp-pub (get signer signer))
       (ok r)
    )
)

;; A helper fn to unwrap a response boolean
;; @param b;
;; @returns bool
(define-private (unwrap-bool (b (response bool bool))) (unwrap-panic b))

;; This function checks if the provided signers are valid, i.e sorted and contain no duplicates, with valid weights and threshold
;; @param new-signers; Signers to validate
;; @returns (response true) or reverts
(define-private (validate-signers (signers {
            signers: (list 100 {signer: (buff 33), weight: uint}),
            threshold: uint,
            nonce: (buff 32)
        }))
    (let
        (
            (signers- (get signers signers))
            (threshold (get threshold signers))
            (total-weight (fold + (map get-signer-weight signers-) u0))
        )
        ;; signers list must have at least one item
        (asserts! (> (len signers-) u0) ERR-SIGNERS-LEN)
        ;; threshold must be bigger than zero
        (asserts! (> threshold u0) ERR-SIGNERS-THRESHOLD)
        ;; total weight of signers must be bigger than the threshold
        (asserts! (>= total-weight threshold) ERR-SIGNERS-THRESHOLD-MISMATCH)
        ;; signer weights need to be > 0
        (asserts! (is-eq (len (filter not (map validate-signer-weight signers-))) u0) ERR-SIGNER-WEIGHT)
        ;; signers need to be in strictly increasing order
        (asserts! (is-eq (len (filter not (map unwrap-bool (map validate-signer-order signers-)))) u0) ERR-SIGNERS-ORDER)
        ;; reset temp var
        (var-set temp-pub NULL-PUB)
        (ok true)
    )
)

;; ############################
;; ### Signature validation ###
;; ############################

(define-constant ERR-INVALID-SIGNATURE-DATA (err u3051))
(define-constant ERR-SIGNATURES-NO-MATCH (err u3053))
(define-constant ERR-LOW-SIGNATURES-WEIGHT (err u3055))

;; Returns true if the address of the signer provided equals to the value stored in temp-account
;; @param signer;
;; @returns bool
(define-private (is-the-signer (signer {signer: (buff 33), weight: uint})) (is-eq (var-get temp-pub) (get signer signer)))


;; This function recovers principal using the value stored in temp-hash + the signature provided and returns matching signer from the temp-signers
;; @param signature;
;; @returns (response {signer: (buff 33), weight: uint}) or (err u0) or (err u1)
(define-private (signature-to-signer (signature (buff 65)))
    (let
       (
            (pub (unwrap! (secp256k1-recover? (var-get temp-hash) signature) (err u0)))
       )
       (var-set temp-pub pub)
       (let
            (
                (signers (filter is-the-signer (var-get temp-signers)))
                (signer (unwrap! (element-at? signers u0) (err u1)))
            )
            (ok signer)
       )
    )
)

;; A helper function to unwrap signer value from an ok response
;; @param signer;
;; @returns {signer: (buff 33), weight: uint}
(define-private (unwrap-signer (signer (response {signer: (buff 33), weight: uint} uint)))
    (unwrap-panic signer)
)

;; A helper function to determine whether the provided signer is an error.
;; @param signer;
;; @returns bool
(define-read-only (is-error-or-signer (signer (response {signer: (buff 33), weight: uint} uint)))
  (is-err signer)
)

;; Accumulates weight of signers
;; @param signer
;; @accumulator
(define-private (accumulate-weights (signer {signer: (buff 33), weight: uint}) (accumulator uint))
    (+ accumulator (get weight signer))
)

;; This function takes message-hash and proof data and reverts if proof is invalid
;; The signers and signatures should be sorted by signer address in ascending order
;; @param message-hash; The hash of the message that was signed
;; @param signers; The weighted signers
;; @param signatures The sorted signatures data
(define-private (validate-signatures
                (message-hash (buff 32))
                (signers {
                    signers: (list 100 {signer: (buff 33), weight: uint}),
                    threshold: uint,
                    nonce: (buff 32)
                })
                (signatures (list 100 (buff 65))
))
    (begin
        ;; Fill temp variables with data will be used in loops
        (var-set temp-hash message-hash)
        (var-set temp-signers (get signers signers))
        (let
            (
                (signers-raw (map signature-to-signer signatures))
                (signer-err (element-at? (filter is-error-or-signer signers-raw) u0))
            )
            (asserts! (is-none signer-err) (unwrap-panic (element-at? (list ERR-INVALID-SIGNATURE-DATA ERR-SIGNATURES-NO-MATCH) (unwrap-err-panic (unwrap-panic signer-err)))))
            (let
                (
                    ;; Convert signatures to signers
                    (signers- (map unwrap-signer signers-raw))
                    ;; Total weight of signatures provided
                    (total-weight (fold accumulate-weights signers- u0))
                )

                ;; Reset temp principal var
                (var-set temp-pub NULL-PUB)
                ;; Signers need to be in strictly increasing order
                (asserts! (is-eq (len (filter not (map unwrap-bool (map validate-signer-order signers-)))) u0) ERR-SIGNERS-ORDER)
                ;; Reset temp vars
                (var-set temp-hash 0x00)
                (var-set temp-signers (list))
                (var-set temp-pub NULL-PUB)
                ;; total-weight must be bigger than the signers threshold
                (asserts! (>= total-weight (get threshold signers)) ERR-LOW-SIGNATURES-WEIGHT)
                (ok true)
            )
        )
    )
)


;; ########################
;; ### Proof validation ###
;; ########################

(define-constant ERR-INVALID-SIGNERS (err u4051))


;; This function takes data-hash and proof data and reverts if proof is invalid
;; @param data-hash; The hash of the message that was signed
;; @param proof; The multisig proof data
;; @returns (response true) or reverts
(define-private (validate-proof (data-hash (buff 32)) (proof {
                signers: {
                    signers: (list 100 {signer: (buff 33), weight: uint}),
                    threshold: uint,
                    nonce: (buff 32)
                },
                signatures: (list 100 (buff 65))
            }))
    (let
        (
            (signers (get signers proof))
            (signers-hash (get-signers-hash signers))
            (signer-epoch (default-to u0 (get-epoch-by-signer-hash signers-hash)))
            (current-epoch (get-epoch))
            ;; True if the proof is from the latest signer set
            (is-latest-signers (is-eq signer-epoch current-epoch))
            (message-hash (message-hash-to-sign signers-hash data-hash))
        )

        (asserts! (is-eq (or (is-eq signer-epoch u0) (> (- current-epoch signer-epoch) (get-previous-signers-retention))) false) ERR-INVALID-SIGNERS)

        (try! (validate-signatures message-hash signers (get signatures proof)))

        (ok is-latest-signers)
    )
)

;; ########################
;; ### Signer rotation ####
;; ########################

(define-constant ERR-INSUFFICIENT-ROTATION-DELAY (err u5051))
(define-constant ERR-SIGNERS-DATA (err u5052))
(define-constant ERR-PROOF-DATA (err u5053))
(define-constant ERR-DUPLICATE-SIGNERS (err u5054))
(define-constant ERR-NOT-LATEST-SIGNERS (err u5055))


;; Updates the last rotation timestamp, and enforces the minimum rotation delay if specified
;; @params enforce-rotation-delay
;; @returns (response true) or reverts
(define-private (update-rotation-timestamp (enforce-rotation-delay bool))
    (let
        (
            (last-rotation-timestamp_ (get-last-rotation-timestamp))
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
        )
        (asserts! (is-eq (and (is-eq enforce-rotation-delay true) (< (- current-ts last-rotation-timestamp_) (get-minimum-rotation-delay))) false) ERR-INSUFFICIENT-ROTATION-DELAY)
        (try! (contract-call? .gateway-storage set-last-rotation-timestamp current-ts))
        (ok true)
    )
)

;; This function rotates the current signers with a new set of signers
;; @param new-signers The new weighted signers data
;; @param enforce-rotation-delay If true, the minimum rotation delay will be enforced
;; @returns (response true) or reverts
(define-public (rotate-signers-inner (new-signers {
                signers: (list 100 {signer: (buff 33), weight: uint}),
                threshold: uint,
                nonce: (buff 32)
            }) (enforce-rotation-delay bool)
)
    (let
            (
                (new-signers-hash (get-signers-hash new-signers))
                (new-epoch (+ (get-epoch) u1))
            )
            (asserts! (is-eq (is-proxy) true) ERR-UNAUTHORIZED)
            (asserts! (is-none (get-epoch-by-signer-hash new-signers-hash)) ERR-DUPLICATE-SIGNERS)
            (try! (validate-signers new-signers))
            (try! (update-rotation-timestamp enforce-rotation-delay))
            (try! (contract-call? .gateway-storage set-epoch new-epoch))
            (try! (contract-call? .gateway-storage set-signer-hash-by-epoch new-epoch new-signers-hash))
            (try! (contract-call? .gateway-storage set-epoch-by-signer-hash new-signers-hash new-epoch))
            (try! (contract-call? .gateway-storage emit-signers-rotated new-epoch new-signers new-signers-hash))
            (ok true)
        )
)

;; Rotate the weighted signers, signed off by the latest Axelar signers.
;; The minimum rotation delay is enforced by default, unless the caller is the gateway operator.
;; The gateway operator allows recovery in case of an incorrect/malicious rotation, while still requiring a valid proof from a recent signer set.
;; Rotation to duplicate signers is rejected.
;; @param new-signers; The data for the new signers.
;; @param proof; The proof signed by the Axelar verifiers for this command.
;; @returns (response true) or reverts
(define-public (rotate-signers
    (new-signers (buff 8192))
    (proof (buff 16384))
)
    (begin
        (asserts! (is-eq (is-proxy) true) ERR-UNAUTHORIZED)
        (asserts! (is-eq (get-is-started) true) ERR-NOT-STARTED)
        (let
            (
                (new-signers_ (unwrap! (from-consensus-buff? {
                    signers: (list 100 {signer: (buff 33), weight: uint}),
                    threshold: uint,
                    nonce: (buff 32)
                } new-signers) ERR-SIGNERS-DATA))
                (proof_ (unwrap! (from-consensus-buff? {
                    signers: {
                        signers: (list 100 {signer: (buff 33), weight: uint}),
                        threshold: uint,
                        nonce: (buff 32)
                    },
                    signatures: (list 100 (buff 65))
                } proof) ERR-PROOF-DATA))
                (data-hash (data-hash-from-signers new-signers_))
                (enforce-rotation-delay (not (is-eq tx-sender (get-operator))))
                (is-latest-signers (try! (validate-proof data-hash proof_)))
            )
            ;; if the caller is not the operator the signer set provided in proof must be the latest
            (asserts! (is-eq (and (is-eq enforce-rotation-delay true) (is-eq is-latest-signers false)) false) ERR-NOT-LATEST-SIGNERS)
            (try! (rotate-signers-inner new-signers_ enforce-rotation-delay))
            (ok true)
        )
    )
)

