(impl-trait .traits.gateway-trait)

(define-public (call-contract 
    (destination-chain (buff 18)) 
    (destination-contract-address (buff 96)) 
    (payload (buff 10240))
) 
    (ok true)
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

(define-public (rotate-signers 
    (new-signers (buff 4096))
    (proof (buff 7168))
)
    (ok true)
)
