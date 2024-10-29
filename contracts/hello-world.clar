(use-trait gateway-trait .traits.gateway-trait)
(use-trait gas-service-trait .traits.gas-service-trait)

(define-data-var value
    {
        source-chain: (string-ascii 20),
        message-id: (string-ascii 128),
        source-address: (string-ascii 128),
        payload: (buff 64000),
    } {
        source-chain: "",
        message-id: "",
        source-address: "",
        payload: 0x00
    }
)

(define-read-only (get-value) (var-get value))

(define-public (set-remote-value
    (destination-chain (string-ascii 20))
    (destination-contract-address (string-ascii 128))
    (payload (buff 64000))
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
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload (buff 64000))
    (gateway <gateway-trait>)
)
    (begin
        (try! (contract-call? gateway validate-message source-chain message-id source-address (keccak256 payload)))
        (var-set value {
            source-chain: source-chain,
            message-id: message-id,
            source-address: source-address,
            payload: payload
        })
        (ok true)
    )
)