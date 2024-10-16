(impl-trait .traits.gateway-trait)

(define-constant NULL-PUB 0x03a1f11842608956458bdcb8a0517348b7a9e21b7cb5f9ccb132f69d0894e68ede)

;; Sends a message to the specified destination chain and address with a given payload.
;; This function is the entry point for general message passing between chains.
;; @param destination-chain; The chain where the destination contract exists. A registered chain name on Axelar must be used here
;; @param destination-contract-address; The address of the contract to call on the destination chain
;; @param payload; The payload to be sent to the destination contract, usually representing an encoded function call with arguments
(define-public (call-contract 
    (destination-chain (string-ascii 32)) 
    (destination-contract-address (string-ascii 48)) 
    (payload (buff 10240))
) 
    (begin 
        (asserts! (is-eq (var-get is-started) true) ERR-NOT-STARTED)
        (print {
            type: "contract-call",
            sender: contract-caller,
            destination-chain: destination-chain,
            destination-contract-address: destination-contract-address,
            payload-hash: (keccak256 payload),
            payload: payload
        })
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
(define-map messages-storage (buff 32) (buff 32))


;; Compute the command-id for a message.
;; @param source-chain The name of the source chain as registered on Axelar.
;; @param message-id The unique message id for the message.
;; @return The commandId for the message.
;; 64
(define-read-only (message-to-command-id (source-chain (string-ascii 32)) (message-id (string-ascii 71))) 
    ;; Axelar doesn't allow `sourceChain` to contain '_', hence this encoding is umambiguous
    (keccak256 (unwrap-panic (to-consensus-buff? (concat (concat source-chain "_") message-id)))))


;; For backwards compatibility with `validateContractCall`, `commandId` is used here instead of `messageId`.
;; @return bytes32 the message hash
(define-private (get-message-hash (message {
        message-id: (string-ascii 71),
        source-chain: (string-ascii 32),
        source-address: (string-ascii 48),
        contract-address: principal,
        payload-hash: (buff 32)
    })) 
    (keccak256 (unwrap-panic (to-consensus-buff? message)))
)

;; Helper function to build keccak256 data-hash from messages
;; @param messages; 
;; @returns (response (buff 32)) 
(define-read-only (data-hash-from-messages (messages (list 10 {
                source-chain: (string-ascii 32),
                message-id: (string-ascii 71),
                source-address: (string-ascii 48),
                contract-address: principal,
                payload-hash: (buff 32)
        })))
    (keccak256 (unwrap-panic (to-consensus-buff? (merge {data: messages} { type: "approve-messages" }))))
)

;; Approves a message if it hasn't been approved before. The message status is set to approved.
;; @params message;
;; @returns (some message) or none
(define-private (approve-message (message {
                source-chain: (string-ascii 32),
                message-id: (string-ascii 71),
                source-address: (string-ascii 48),
                contract-address: principal,
                payload-hash: (buff 32)
            })) 
            (let (
                    (command-id (message-to-command-id (get source-chain message) (get message-id message)))
                )
                (if 
                    (map-insert messages-storage command-id (get-message-hash {
                        message-id: (get message-id message),
                        source-chain: (get source-chain message),
                        source-address: (get source-address message),
                        contract-address: (get contract-address message),
                        payload-hash: (get payload-hash message)
                    }))
                    (some (print (merge message {
                        type: "message-approved",
                        command-id: command-id,
                    })))
                    none)))


;; @notice Approves an array of messages, signed by the Axelar signers.
;; @param messages; The list of messages to verify.
;; @param proof; The proof signed by the Axelar signers for this command.
;; @returns (response true) or reverts
(define-public (approve-messages 
    (messages (buff 4096)) 
    (proof (buff 7168))) 
    (let (
        (proof_ (unwrap! (from-consensus-buff? { 
                signers: {
                    signers: (list 48 {signer: (buff 33), weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                },
                signatures: (list 48 (buff 65))
            } proof) ERR-SIGNERS-DATA))
        (messages_ (unwrap! (from-consensus-buff? 
            (list 10 {
                source-chain: (string-ascii 32),
                message-id: (string-ascii 71),
                source-address: (string-ascii 48),
                contract-address: principal,
                payload-hash: (buff 32)
            })
            messages) ERR-MESSAGES-DATA))
             (data-hash (data-hash-from-messages messages_)
        ))
        (asserts! (is-eq (var-get is-started) true) ERR-NOT-STARTED)
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
    (source-chain (string-ascii 32)) 
    (message-id (string-ascii 71)) 
    (source-address (string-ascii 48)) 
    (payload-hash (buff 32))
) 
    (let (
        (command-id (message-to-command-id source-chain message-id))
        (message-hash (get-message-hash {
                message-id: message-id,
                source-chain: source-chain,
                source-address: source-address,
                contract-address: contract-caller,
                payload-hash: payload-hash
            }))
    ) 
        (asserts! (is-eq (var-get is-started) true) ERR-NOT-STARTED)
        (asserts! (is-eq (get-message command-id) message-hash) ERR-MESSAGE-NOT-FOUND)
        (map-set messages-storage command-id MESSAGE-EXECUTED)
        (print {
            type: "message-executed",
            command-id: command-id,
            source-chain: source-chain,
            message-id: message-id,
        })
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
    (source-chain (string-ascii 32))
    (message-id (string-ascii 71))
    (source-address (string-ascii 48)) 
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
    (source-chain (string-ascii 32))
    (message-id (string-ascii 71))
) 
    (ok (is-eq MESSAGE-EXECUTED (get-message (message-to-command-id source-chain message-id))))
)

;; Message getter with the command-id. Returns an empty buffer if no message matched.
;; @param command-id
;; @returns (buff 32) or (buff 1)
(define-read-only (get-message
    (command-id (buff 32))
)
    (default-to 0x00 (map-get? messages-storage command-id))
)

;; ####################
;; ####################
;; ### Operatorship ###
;; ####################
;; ####################

(define-constant ERR-ONLY-OPERATOR (err u1051))

(define-data-var operator principal contract-caller)
(define-read-only (get-operator) (var-get operator))

;; Transfers operatorship to a new account
(define-public (transfer-operatorship (new-operator principal)) 
    (begin
        (asserts! (is-eq (var-get is-started) true) ERR-NOT-STARTED)
        (asserts! (is-eq contract-caller (var-get operator)) ERR-ONLY-OPERATOR)
        (var-set operator new-operator)
        (print {action: "transfer-operatorship", new-operator: new-operator})
        (ok true)
    )
)

;; #########################
;; #########################
;; ### Weighted Multisig ###
;; #########################
;; #########################

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
(define-data-var domain-separator (buff 32) 0x00)
(define-read-only (get-domain-separator) (var-get domain-separator))

;; The minimum delay required between rotations
(define-data-var minimum-rotation-delay uint u0)
(define-read-only (get-minimum-rotation-delay) (var-get minimum-rotation-delay))

;; Helper vars to use within loops
(define-data-var temp-pub (buff 33) NULL-PUB)
(define-data-var temp-hash (buff 32) 0x00)
(define-data-var temp-signers (list 48 {signer: (buff 33), weight: uint}) (list))

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
                (var-get domain-separator)
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
                signers: (list 48 {signer: (buff 33), weight: uint}), 
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
                signers: (list 48 {signer: (buff 33), weight: uint}), 
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

;; A helper fn to get bytes of an account
;; @param p; The principal
;; @returns (buff 20)
(define-private (principal-to-bytes (p principal)) (get hash-bytes (unwrap-panic (principal-destruct? p))))

;; Returns weight of a signer
;; @param signer; Signer to validate
;; @returns uint
(define-private (get-signer-weight (signer {signer: (buff 33), weight: uint})) (get weight signer))

;; Validates a particular signer
;; @param signer; Signer to validate
;; @returns (response true) or reverts
(define-private (validate-signer (signer {signer: (buff 33), weight: uint})) 
    (begin 
       ;; signer weight must be bigger than zero
       (asserts! (> (get weight signer) u0) ERR-SIGNER-WEIGHT)
       ;; save this signer in order to do comparison with the next signer
       (var-set temp-pub (get signer signer))
       (ok true)
    )
)

;; Validates signer order
;; @param signer; Signer to validate
;; @returns (response true) or reverts
(define-private (validate-signer-order (signer {signer: (buff 33), weight: uint})) 
    (begin 
       ;; signers need to be in strictly increasing order
       (asserts! (> (principal-to-bytes (unwrap-panic (principal-of? (get signer signer)))) (principal-to-bytes (unwrap-panic (principal-of? (var-get temp-pub))))) ERR-SIGNERS-ORDER)
       ;; save this signer in order to do comparison with the next signer
       (var-set temp-pub (get signer signer))
       (ok true)
    )
)

;; This function checks if the provided signers are valid, i.e sorted and contain no duplicates, with valid weights and threshold
;; @param new-signers; Signers to validate
;; @returns (response true) or reverts
(define-private (validate-signers (signers { 
            signers: (list 48 {signer: (buff 33), weight: uint}), 
            threshold: uint, 
            nonce: (buff 32) 
        })) 
    (let
        (
            (signers_ (get signers signers))
            (threshold (get threshold signers))
            (total-weight (fold + (map get-signer-weight signers_) u0))
        )
        ;; signers list must have at least one item
        (asserts! (> (len signers_) u0) ERR-SIGNERS-LEN)
        ;; threshold must be bigger than zero
        (asserts! (> threshold u0) ERR-SIGNERS-THRESHOLD)
        ;; total weight of signers must be bigger than the threshold
        (asserts! (>= total-weight threshold) ERR-SIGNERS-THRESHOLD-MISMATCH)
        ;; signer specific validations
        (map validate-signer signers_)
        (map validate-signer-order signers_)
        ;; reset temp var
        (var-set temp-pub NULL-PUB)
        (ok true)
    )
)

;; ############################
;; ### Signature validation ###
;; ############################


(define-constant ERR-INVALID-SIGNATURE-DATA (err u3051))
(define-constant ERR-MALFORMED-SIGNATURES (err u3056))
(define-constant ERR-LOW-SIGNATURES-WEIGHT (err u3058))

;; Returns true if the address of the signer provided equals to the value stored in temp-account
;; @param signer;
;; @returns bool
(define-private (is-the-signer (signer {signer: (buff 33), weight: uint})) (is-eq (var-get temp-pub) (get signer signer)))


;; This function recovers principal using the value stored in temp-hash + the signature provided and returns matching signer from the temp-signers
;; @param signature;
;; @returns (response {signer: (buff 33), weight: uint}) or reverts
(define-private (signature-to-signer (signature (buff 65))) 
    (let 
       (
            (pub (unwrap! (secp256k1-recover? (var-get temp-hash) signature) ERR-INVALID-SIGNATURE-DATA))
       )
       (var-set temp-pub pub)
       (let 
            (
                (signers (filter is-the-signer (var-get temp-signers)))
                (signer (unwrap! (element-at? signers u0) ERR-MALFORMED-SIGNATURES))   
            )
            ;; there must be only one match
            (asserts! (is-eq (len signers) u1) ERR-MALFORMED-SIGNATURES)
            (ok signer)
       )
    )
)


;; A helper function to unwrap signer value from an ok response
;; @param p; 
;; @returns {signer: (buff 33), weight: uint}
(define-private (unwrap-signer (signer (response {signer: (buff 33), weight: uint} uint)))
    (unwrap-panic signer)
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
                    signers: (list 48 {signer: (buff 33), weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                })
                (signatures (list 48 (buff 65))
)) 
    (begin 
        ;; Fill temp variables with data will be used in loops
        (var-set temp-hash message-hash)
        (var-set temp-signers (get signers signers))
        (let  
            (
                ;; Convert signatures to signers
                (signers_ (map unwrap-signer (map signature-to-signer signatures)))
                ;; Total weight of signatures provided
                (total-weight (fold accumulate-weights signers_ u0))
            )
            ;; Reset temp principal var
            (var-set temp-pub NULL-PUB)
            ;; Make sure order
            (map validate-signer-order signers_)
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
                    signers: (list 48 {signer: (buff 33), weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                },
                signatures: (list 48 (buff 65))
            })) 
    (let 
        (
            (signers (get signers proof))
            (signers-hash (get-signers-hash signers))
            (signer-epoch (default-to u0 (map-get? epoch-by-signer-hash signers-hash)))
            (current-epoch (var-get epoch))
            ;; True if the proof is from the latest signer set
            (is-latest-signers (is-eq signer-epoch current-epoch))
            (message-hash (message-hash-to-sign signers-hash data-hash))
        ) 

        (asserts! (is-eq (or (is-eq signer-epoch u0) (> (- current-epoch signer-epoch) (var-get previous-signers-retention))) false) ERR-INVALID-SIGNERS)

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
            (last-rotation-timestamp_ (var-get last-rotation-timestamp))
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
        )
        (asserts! (is-eq (and (is-eq enforce-rotation-delay true) (< (- current-ts last-rotation-timestamp_) (var-get minimum-rotation-delay))) false) ERR-INSUFFICIENT-ROTATION-DELAY)
        (var-set last-rotation-timestamp current-ts)
        (ok true)
    )
)

;; This function rotates the current signers with a new set of signers
;; @param new-signers The new weighted signers data
;; @param enforce-rotation-delay If true, the minimum rotation delay will be enforced
;; @returns (response true) or reverts
(define-private (rotate-signers-inner (new-signers { 
                signers: (list 48 {signer: (buff 33), weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            }) (enforce-rotation-delay bool)
)
    (let 
            (
                (new-signers-hash (get-signers-hash new-signers))
                (new-epoch (+ (var-get epoch) u1))
            )
            (asserts! (is-none (map-get? epoch-by-signer-hash new-signers-hash)) ERR-DUPLICATE-SIGNERS)
            (try! (validate-signers new-signers))
            (try! (update-rotation-timestamp enforce-rotation-delay))
            (var-set epoch new-epoch)
            (map-set signer-hash-by-epoch new-epoch new-signers-hash)
            (map-set epoch-by-signer-hash new-signers-hash new-epoch)
            (print {
                type: "signers-rotated",
                epoch: new-epoch,
                signers-hash: new-signers-hash, 
                signers: new-signers
            })
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
    (new-signers (buff 4096))
    (proof (buff 7168))
)
    (begin 
        (asserts! (is-eq (var-get is-started) true) ERR-NOT-STARTED)
        (let 
            (
                (new-signers_ (unwrap! (from-consensus-buff? { 
                    signers: (list 48 {signer: (buff 33), weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                } new-signers) ERR-SIGNERS-DATA))
                (proof_ (unwrap! (from-consensus-buff? { 
                    signers: {
                        signers: (list 48 {signer: (buff 33), weight: uint}), 
                        threshold: uint, 
                        nonce: (buff 32) 
                    },
                    signatures: (list 48 (buff 65))
                } proof) ERR-PROOF-DATA))
                (data-hash (data-hash-from-signers new-signers_))
                (enforce-rotation-delay (not (is-eq contract-caller (var-get operator))))
                (is-latest-signers (try! (validate-proof data-hash proof_)))
            )
            (asserts! (is-eq (and (is-eq enforce-rotation-delay true) (is-eq is-latest-signers false)) false) ERR-NOT-LATEST-SIGNERS)
            (try! (rotate-signers-inner new-signers_ enforce-rotation-delay))
            (ok true)
        )
    )
)


;; ######################
;; ######################
;; ### Initialization ###
;; ######################
;; ######################

(define-constant ERR-STARTED (err u6051))
(define-constant ERR-NOT-STARTED (err u6052))

(define-data-var is-started bool false)
(define-read-only (get-is-started) (var-get is-started))

;; Constructor function
;; @param signers; The data for the new signers.
;; @param operator_
;; @previous-signers-retention_
;; @domain-separator_
;; @minimum-rotation-delay_
;; @returns (response true) or reverts
(define-public (setup 
    (signers (buff 4096)) 
    (operator_ principal) 
    (domain-separator_ (buff 32)) 
    (minimum-rotation-delay_ uint)
    (previous-signers-retention_ uint) 
) 
    (let
        (
            (signers_ (unwrap! (from-consensus-buff? { 
                signers: (list 48 {signer: (buff 33), weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            } signers) ERR-SIGNERS-DATA))
        )
        (asserts! (is-eq (var-get is-started) false) ERR-STARTED)
        (try! (rotate-signers-inner signers_ false))
        (var-set operator operator_)
        (var-set domain-separator domain-separator_)
        (var-set minimum-rotation-delay minimum-rotation-delay_)
        (var-set previous-signers-retention previous-signers-retention_)
        (var-set is-started true) 
        (ok true)
    )
)
