# Gateway Contract

## Interface

```clarity
(define-public (set-paused 
    (status bool)))
```

```clarity
(define-public (transfer-operatorship
    (new-operator principal)))
```


```clarity
(define-public (set-trusted-address 
    (chain-name (string-ascii 18))
    (address (string-ascii 48))))
```

```clarity
(define-public (remove-trusted-address  
    (chain-name (string-ascii 18))))
```

```clarity
(define-public (deploy-token-manager
            (salt (buff 32))
            (destination-chain (string-ascii 18))
            (token-manager-type uint)
            (token <sip-010-trait>)
            (token-manager <token-manager-trait>)
            (gas-value uint))
) 
```

```clarity
(define-public (execute-enable-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (payload (buff 1024))))
```

```clarity
(define-public (deploy-interchain-token
        (salt (buff 32))
        (destination-chain (string-ascii 18))
        (name (string-ascii 32))
        (symbol (string-ascii 32))
        (decimals uint)
        (minter (buff 32))
        (gas-value uint)))
```

```clarity
(define-public (interchain-transfer
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 18))
        (destination-address (buff 100))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 1024)
        })
        (gas-value uint)))
```

```clarity
(define-public (call-contract-with-interchain-token
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 18))
        (destination-address (buff 100))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 1024)
        })
        (gas-value uint)))
```

```clarity
(define-public (execute-deploy-interchain-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (token-address principal)
        (payload (buff 1024))))
```

```clarity
(define-public (execute-receive-interchain-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (destination-contract <interchain-token-executable-trait>)
        (payload (buff 1024))))
```

```clarity
(define-public (setup
    (its-contract-address-name (string-ascii 48))
    (interchain-token-factory_ principal)
))
```

## Types

### Events
```clarity
{action: "transfer-operatorship", new-operator: new-operator}
{
    type: "trusted-address-set",
    chain: (string-ascii 48),
    address: principal
}
{
    type: "trusted-address-removed",
    chain: (string-ascii 48)
}
{
    type: "interchain-token-id-claimed",
    token-id: (buff 32),
    deployer: principal,
    salt: (buff 32),
}
{
    type: "token-manager-deployed",
    token-id: (buff 32),
    token-manager: principal,
    token-type: uint,
}
{
    type:"interchain-token-deployment-started",
    token-id: (buff 32),
    name: (string-ascii 32),
    symbol: (string-ascii 32),
    decimals: uint,
    minter: principal,
    destination-chain: (string-ascii 18),
}
{
    type: "interchain-transfer",
    token-id: (buff 32),
    source-address: principal,
    destination-chain: (string-ascii 18),
    destination-address: (buff 100),
    amount: uint,
    data: (buff 32)
}
{
    type: "token-manager-deployed",
    token-id: (buff 32),
    token-manager: principal,
    token-type: uint,
}
{
    type: "interchain-transfer-received",
    token-id: (buff 32),
    source-chain: (string-ascii 18),
    source-address: (string-ascii 48),
    destination-address: (buff 64),
    amount: uint,
    data: (buff 32),
}
```
