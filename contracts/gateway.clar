(impl-trait .traits.gateway-trait)

(define-constant NULL-ADDRESS 'SP000000000000000000002Q6VF78)

;; Sends a message to the specified destination chain and address with a given payload.
;; This function is the entry point for general message passing between chains.
;; @param destination-chain; The chain where the destination contract exists. A registered chain name on Axelar must be used here
;; @param destination-contract-address; The address of the contract to call on the destination chain
;; @param payload; The payload to be sent to the destination contract, usually representing an encoded function call with arguments
(define-public (call-contract 
    (destination-chain (buff 18)) 
    (destination-contract-address (buff 96)) 
    (payload (buff 10240))
) 
    (begin 
        (print {
            type: "contract-call",
            sender: tx-sender,
            destination-chain: destination-chain,
            destination-contract-address: destination-contract-address,
            payload-hash: (keccak256 payload),
            payload: payload
        })
        (ok true)
    )
)

(define-public (approve-messages 
    (messages (buff 4096)) 
    (proof (buff 7168))
)
    (ok true)
)

(define-public (validate-message 
    (source-chain (buff 18)) 
    (message-id (buff 32)) 
    (source-address (buff 96)) 
    (payload-hash (buff 32))
) 
    (ok true)
)

(define-read-only (is-message-approved 
    (source-chain (buff 18))
    (message-id (buff 32))
    (source-address (buff 96)) 
    (contract-address (buff 96)) 
    (payload-hash (buff 32))
)
    (ok true)
)

(define-read-only (is-message-executed
    (source-chain (buff 18))
    (message-id (buff 32))
) 
    (ok true)
)

;; ####################
;; ####################
;; ### Operatorship ###
;; ####################
;; ####################

(define-constant ERR-ONLY-OPERATOR (err u1051))

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
(define-data-var domain-separator (buff 24) 0x5f5f) ;; __
(define-read-only (get-domain-separator) (var-get domain-separator))

;; The minimum delay required between rotations
(define-data-var minimum-rotation-delay uint u0)
(define-read-only (get-minimum-rotation-delay) (var-get minimum-rotation-delay))

;; Helper vars to use within loops
(define-data-var temp-account principal NULL-ADDRESS)
(define-data-var temp-hash (buff 32) 0x00)
(define-data-var temp-signers (list 32 {signer: principal, weight: uint}) (list))

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
(define-private (get-signer-weight (signer {signer: principal, weight: uint})) (get weight signer))

;; Validates a particular signer
;; @param signer; Signer to validate
;; @returns (response true) or reverts
(define-private (validate-signer (signer {signer: principal, weight: uint})) 
    (begin 
       ;; signer weight must be bigger than zero
       (asserts! (> (get weight signer) u0) ERR-SIGNER-WEIGHT)
       ;; save this signer in order to do comparison with the next signer
       (var-set temp-account (get signer signer))
       (ok true)
    )
)

;; Validates signer order
;; @param signer; Signer to validate
;; @returns (response true) or reverts
(define-private (validate-signer-order (signer {signer: principal, weight: uint})) 
    (begin 
       ;; signers need to be in strictly increasing order
       (asserts! (> (principal-to-bytes (get signer signer)) (principal-to-bytes (var-get temp-account))) ERR-SIGNERS-ORDER)
       ;; save this signer in order to do comparison with the next signer
       (var-set temp-account (get signer signer))
       (ok true)
    )
)

;; This function checks if the provided signers are valid, i.e sorted and contain no duplicates, with valid weights and threshold
;; @param new-signers; Signers to validate
;; @returns (response true) or reverts
(define-private (validate-signers (signers { 
            signers: (list 32 {signer: principal, weight: uint}), 
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
        (var-set temp-account NULL-ADDRESS)
        (ok true)
    )
)

;; ############################
;; ### Signature validation ###
;; ############################


(define-constant ERR-INVALID-SIGNATURE-DATA (err u3051))
(define-constant ERR-INVALID-SIGNATURE-DATA-TYPE (err u3053))
(define-constant ERR-MALFORMED-SIGNATURES (err u3056))
(define-constant ERR-LOW-SIGNATURES-WEIGHT (err u3058))

;; Returns true if the address of the signer provided equals to the value stored in temp-account
;; @param signer;
;; @returns bool
(define-private (is-the-signer (signer {signer: principal, weight: uint})) (is-eq (var-get temp-account) (get signer signer)))


;; This function recovers principal using the value stored in temp-hash + the signature provided and returns matching signer from the temp-signers
;; @param signature;
;; @returns (response {signer: principal, weight: uint}) or reverts
(define-private (signature-to-signer (signature (buff 65))) 
    (let 
       (
            (address (unwrap! 
                (principal-of?
                    (unwrap! 
                        (secp256k1-recover? (var-get temp-hash) signature)
                        ERR-INVALID-SIGNATURE-DATA
                    )
                )
                ERR-INVALID-SIGNATURE-DATA-TYPE
            ))
       )
       (var-set temp-account address)
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


;; A helper function to unwrap principal value from an ok response
;; @param p; 
;; @returns {signer: principal, weight: uint}
(define-private (unwrap-signer (signer (response {signer: principal, weight: uint} uint)))
    (unwrap-panic signer)
)


;; Accumulates weight of signers 
;; @param signer
;; @accumulator
(define-private (accumulate-weights (signer {signer: principal, weight: uint}) (accumulator uint))
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
                    signers: (list 32 {signer: principal, weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                })
                (signatures (list 32 (buff 65))
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
            (var-set temp-account NULL-ADDRESS)
            ;; Make sure order
            (map validate-signer-order signers_)
            ;; Reset temp vars
            (var-set temp-hash 0x00)
            (var-set temp-signers (list))
            (var-set temp-account NULL-ADDRESS)
            ;; total-weight must be bigger than the signers threshold 
            (asserts! (>= total-weight (get threshold signers)) ERR-LOW-SIGNATURES-WEIGHT)
            (ok true) 
        )    
    )
)


;; ########################
;; ### Proof validation ###
;; ########################

(define-constant ERR-SIGNERS-RETENTION (err u4051))


;; This function takes data-hash and proof data and reverts if proof is invalid
;; @param data-hash; The hash of the message that was signed
;; @param proof; The multisig proof data
;; @returns (response true) or reverts
(define-private (validate-proof (data-hash (buff 32)) (proof { 
                signers: {
                    signers: (list 32 {signer: principal, weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                },
                signatures: (list 32 (buff 65))
            })) 
    (let 
        (
            (signers (get signers proof))
            (signers-hash (keccak256 (unwrap-panic (to-consensus-buff? signers))))
            (signer-epoch (default-to u0 (map-get? epoch-by-signer-hash signers-hash)))
            (current-epoch (var-get epoch))
            ;; True if the proof is from the latest signer set
            (is-latest-signers (is-eq signer-epoch current-epoch))
            (message-hash (message-hash-to-sign signers-hash data-hash))
        ) 

        (and 
            (or 
                (is-eq signer-epoch u0) 
                (> (- current-epoch signer-epoch) (var-get previous-signers-retention))
            ) 
            (asserts! (is-eq 0 1) ERR-SIGNERS-RETENTION)
        )

        (try! (validate-signatures message-hash signers (get signatures proof)))

        (ok is-latest-signers)
    )
)

;; ########################
;; ### Signer rotation ####
;; ########################

(define-constant ERR-INSUFFICIENT-ROTATION-DELAY (err u5051))
(define-constant ERR-SIGNERS-DATA (err u5052))
(define-constant ERR-PROOF-DATA (err u5052))
(define-constant ERR-DUPLICATE-SIGNERS (err u5053))
(define-constant ERR-NOT-LATEST-SIGNERS (err u5054))


;; Updates the last rotation timestamp, and enforces the minimum rotation delay if specified
;; @params enforce-rotation-delay
;; @returns (response true) or reverts
(define-private (update-rotation-timestamp (enforce-rotation-delay bool)) 
    (let   
        (
            (last-rotation-timestamp_ (var-get last-rotation-timestamp))
            (current-ts (unwrap-panic (get-block-info? time (- block-height u1))))
        )
        (and enforce-rotation-delay (< (- current-ts last-rotation-timestamp_) (var-get minimum-rotation-delay)) (asserts! (is-eq 0 1) ERR-INSUFFICIENT-ROTATION-DELAY))
        (var-set last-rotation-timestamp current-ts)
        (ok true)
    )
)

;; This function rotates the current signers with a new set of signers
;; @param new-signers The new weighted signers data
;; @param enforce-rotation-delay If true, the minimum rotation delay will be enforced
;; @returns (response true) or reverts
(define-private (rotate-signers-inner (new-signers { 
                signers: (list 32 {signer: principal, weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            }) (enforce-rotation-delay bool)
)
    (let 
            (
                (new-signers-hash (keccak256 (unwrap-panic (to-consensus-buff? new-signers))))
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
    (let 
        (
            (new-signers_ (unwrap! (from-consensus-buff? { 
                signers: (list 32 {signer: principal, weight: uint}), 
                threshold: uint, 
                nonce: (buff 32) 
            } new-signers) ERR-SIGNERS-DATA))
            (proof_ (unwrap! (from-consensus-buff? { 
                signers: {
                    signers: (list 32 {signer: principal, weight: uint}), 
                    threshold: uint, 
                    nonce: (buff 32) 
                },
                signatures: (list 32 (buff 65))
            } proof) ERR-PROOF-DATA))
            (data-hash (keccak256 (unwrap-panic (to-consensus-buff? (merge new-signers_ { type: "rotate-signers"})))))
            (enforce-rotation-delay (not (is-eq tx-sender (var-get operator))))
            (is-latest-signers (try! (validate-proof data-hash proof_)))
        )
        (and 
            (is-eq enforce-rotation-delay true)
            (is-eq is-latest-signers false) 
            (asserts! (is-eq 0 1) ERR-NOT-LATEST-SIGNERS)
        )
        (try! (rotate-signers-inner new-signers_ enforce-rotation-delay))
        (ok true)
    )
)

(rotate-signers-inner {signers: (list {signer: tx-sender, weight: u1}),threshold: u1,nonce: 0x00} false)