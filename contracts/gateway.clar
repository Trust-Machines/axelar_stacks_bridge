(impl-trait .traits.gateway-trait)


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

;; ***********************
;; ** Weighted Multisig **
;; ***********************

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

;; Compute the message hash that is signed by the weighted signers
;; Returns an Stacks Signed Message, created from `domainSeparator`, `signersHash`, and `dataHash`.
;; @param signers-hash; The hash of the weighted signers that sign off on the data
;; @param data-hash; The hash of the data
;; @return (buff 32); The message hash to be signed
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

(define-public (rotate-signers 
    (new-signers (buff 4096))
    (proof (buff 7168))
)
    (ok true)
)
