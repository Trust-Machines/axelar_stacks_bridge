(use-trait gateway-trait .traits.gateway-trait)
(use-trait gas-service-trait .traits.gas-service-trait)

(define-data-var last-payload (buff 10240) 0x00)
(define-read-only (get-last-payload) (var-get last-payload))

(define-data-var last-source-chain (string-ascii 32) "")
(define-read-only (get-last-source-chain) (var-get last-source-chain))

(define-data-var last-source-address (string-ascii 48) "")
(define-read-only (get-last-source-address) (var-get last-source-address))

(define-public (set-remote-value 
    (destination-chain (string-ascii 32)) 
    (destination-contract-address (string-ascii 48)) 
    (payload (buff 10240))
    (gas-amount uint)
    (gateway <gateway-trait>)
    (gas-service <gas-service-trait>)
)
    (begin 
        (try! (stx-transfer? gas-amount contract-caller (as-contract tx-sender)))
        (try! 
            (contract-call? gas-service pay-native-gas-for-contract-call 
                gas-amount 
                (as-contract tx-sender) 
                destination-chain 
                destination-contract-address 
                payload 
                contract-caller
            )
        )
        (try! (contract-call? gateway call-contract destination-chain destination-contract-address payload))
        (ok true)
    )
)

(define-public (execute 
    (source-chain (string-ascii 32)) 
    (message-id (string-ascii 71)) 
    (source-address (string-ascii 48)) 
    (payload (buff 10240))
    (gateway <gateway-trait>)
) 
    (begin 
        (try! (contract-call? gateway validate-message source-chain message-id source-address (keccak256 payload)))
        (var-set last-source-chain source-chain)
        (var-set last-source-address source-address)
        (var-set last-payload payload)
        (ok true)
    )
)