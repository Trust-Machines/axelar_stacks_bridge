# Interchain Token Service Contract

## Public Functions

### 1. `set-paused`
Sets the paused status of the contract.
```clarity
(define-public (set-paused 
    (status bool)))
```

### 2. `transfer-operatorship`
Transfers operatorship to a new account.
```clarity
(define-public (transfer-operatorship
    (new-operator principal)))
```

### 3. `set-trusted-address`
Sets the trusted address for a given chain.
```clarity
(define-public (set-trusted-address 
    (chain-name (string-ascii 18))
    (address (string-ascii 48))))
```

### 4. `remove-trusted-address`
Removes the trusted address for a given chain.
```clarity
(define-public (remove-trusted-address  
    (chain-name (string-ascii 18))))
```

### 5. `deploy-token-manager`
Deploys a token manager on a destination chain.
```clarity
(define-public (deploy-token-manager
            (salt (buff 32))
            (destination-chain (string-ascii 18))
            (token-manager-type uint)
            (token <sip-010-trait>)
            (token-manager <token-manager-trait>)
            (gas-value uint)))
```

### 6. `execute-enable-token`
Executes the enable token process.
```clarity
(define-public (execute-enable-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (payload (buff 1024))))
```

### 7. `deploy-interchain-token`
Deploys an interchain token on a destination chain.
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

### 8. `interchain-transfer`
Initiates an interchain transfer of a specified token to a destination chain.
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

### 9. `call-contract-with-interchain-token`
Calls a contract on a destination chain with an interchain token.
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

### 10. `execute-deploy-interchain-token`
Executes the deployment of an interchain token.
```clarity
(define-public (execute-deploy-interchain-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (source-address (string-ascii 48))
        (token-address principal)
        (payload (buff 1024))))
```

### 11. `execute-receive-interchain-token`
Executes the receipt of an interchain token.
```clarity
(define-public (execute-receive-interchain-token
        (message-id (string-ascii 71))
        (source-chain (string-ascii 18))
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (destination-contract <interchain-token-executable-trait>)
        (payload (buff 1024))))
```

### 12. `setup`
Sets up the interchain token service contract.
```clarity
(define-public (setup
    (its-contract-address-name (string-ascii 48))
    (interchain-token-factory-address principal)
    (gateway-address principal)
    (gas-service-address principal)
    (operator-address principal)
    (trusted-chain-names-addresses (list 50 {chain-name: (string-ascii 18), address: (string-ascii 48)}))
))

## Events

### 1. `transfer-operatorship`
Emitted when operatorship is transferred to a new account.
```clarity
{
    action: "transfer-operatorship", 
    new-operator: new-operator
}
```

### 2. `trusted-address-set`
Emitted when a trusted address is set for a chain.
```clarity
{
    type: "trusted-address-set",
    chain: (string-ascii 48),
    address: principal
}
```

### 3. `trusted-address-removed`
Emitted when a trusted address is removed for a chain.
```clarity
{
    type: "trusted-address-removed",
    chain: (string-ascii 48)
}
```

### 4. `interchain-token-id-claimed`
Emitted when an interchain token ID is claimed.
```clarity
{
    type: "interchain-token-id-claimed",
    token-id: (buff 32),
    deployer: principal,
    salt: (buff 32),
}
```

### 5. `token-manager-deployed`
Emitted when a token manager is deployed.
```clarity
{
    type: "token-manager-deployed",
    token-id: (buff 32),
    token-manager: principal,
    token-type: uint,
}
```

### 6. `interchain-token-deployment-started`
Emitted when an interchain token deployment is started.
```clarity
{
    type:"interchain-token-deployment-started",
    token-id: (buff 32),
    name: (string-ascii 32),
    symbol: (string-ascii 32),
    decimals: uint,
    minter: principal,
    destination-chain: (string-ascii 18),
}
```

### 7. `interchain-transfer`
Emitted when an interchain transfer is initiated.
```clarity
{
    type: "interchain-transfer",
    token-id: (buff 32),
    source-address: principal,
    destination-chain: (string-ascii 18),
    destination-address: (buff 100),
    amount: uint,
    data: (buff 32)
}
```

### 8. `token-manager-deployed`
Emitted when a token manager is deployed.
```clarity
{
    type: "token-manager-deployed",
    token-id: (buff 32),
    token-manager: principal,
    token-type: uint,
}
```

### 9. `interchain-transfer-received`
Emitted when an interchain transfer is received.
```clarity
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
