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

### 6. `process-deploy-token-manager-from-stacks`

Executes the enable token process.

```clarity
(define-public (process-deploy-token-manager-from-stacks
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
```

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

### 10 ITS Hub events

```clarity
{
    destination-address: destination-address,
    destination-chain: (var-get its-hub-chain),
    payload: (unwrap-panic (to-consensus-buff? {
        type: MESSAGE-TYPE-SEND-TO-HUB,
        destination-chain: destination-chain,
        payload: payload,
    })),
}
```

Deserialization example:

_with below contract call parameters:_

Deploy remote token manager:

```clarity
{
    type: "contract-call",
    destination-chain: "axelar",
    destination-contract-address: "cosmwasm",
    payload-hash: 0x7453579e65ea51addefcc1bdf51615212aea8a631c0f4d56fc810c16b99f1a3f,
    payload: 0x0c0000000608646563696d616c730100000000000000000000000000000006066d696e746572020000000100046e616d650d0000000673616d706c650673796d626f6c0d0000000673616d706c6508746f6b656e2d6964020000002042fad3435446674f88b47510fe7d2d144c8867c405d4933007705db85f37ded504747970650100000000000000000000000000000001,
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service,
}
```

```ts
import { cvToJSON, hexToCV, Cl } from "@stacks/transactions";

const hex =
  "0x0c000000061164657374696e6174696f6e2d636861696e0d000000066178656c61721c64657374696e6174696f6e2d636f6e74726163742d616464726573730d00000008636f736d7761736d077061796c6f616402000000d90c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f616402000000920c0000000608646563696d616c730100000000000000000000000000000006066d696e746572020000000100046e616d650d0000000673616d706c650673796d626f6c0d0000000673616d706c6508746f6b656e2d69640200000020d6217727e786ecf249d79ae4b3f6f67ee585ec34f2b1e769ab83b13416d669d504747970650100000000000000000000000000000001047479706501000000000000000000000000000000030c7061796c6f61642d686173680200000020d43fb458860984847ad52f4395cfda8aa6fdb7a4cde7d2de36caa51ff25326170673656e646572061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce18696e746572636861696e2d746f6b656e2d7365727669636504747970650d0000000d636f6e74726163742d63616c6c";

const json = cvToJSON(hexToCV(hex));

console.log("type:", json.value["type"].value);
console.log("destination-chain:", json.value["destination-chain"].value);
console.log(
  "destination-contract-address:",
  json.value["destination-contract-address"].value
);
console.log("payload:", json.value["payload"].value);
console.log("payload-hash:", json.value["payload-hash"].value);
console.log("sender:", json.value["sender"].value);
console.log(
  "decoded-wrapped-payload,",
  Cl.prettyPrint(hexToCV(json.value["payload"].value))
);
```

Output:

```
'type:' 'contract-call'
'destination-chain:' 'axelar'
'destination-contract-address:' 'cosmwasm'
'payload:' '0x0c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f616402000000920c0000000608646563696d616c730100000000000000000000000000000006066d696e746572020000000100046e616d650d0000000673616d706c650673796d626f6c0d0000000673616d706c6508746f6b656e2d69640200000020d6217727e786ecf249d79ae4b3f6f67ee585ec34f2b1e769ab83b13416d669d50474797065010000000000000000000000000000000104747970650100000000000000000000000000000003'
'payload-hash:' '0xd43fb458860984847ad52f4395cfda8aa6fdb7a4cde7d2de36caa51ff2532617'
'sender:' 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service'
'decoded-wrapped-payload,' '{ destination-chain: "ethereum", payload: 0x0c0000000608646563696d616c730100000000000000000000000000000006066d696e746572020000000100046e616d650d0000000673616d706c650673796d626f6c0d0000000673616d706c6508746f6b656e2d69640200000020d6217727e786ecf249d79ae4b3f6f67ee585ec34f2b1e769ab83b13416d669d504747970650100000000000000000000000000000001, type: u3 }'
```

Deploy remote interchain token:

```clj
{
    type: "contract-call"
    destination-chain: "axelar",
    destination-contract-address: "0x00",
    payload-hash: 0x143ea026e2432609fa5f28c9e43bf24842b2079dbf819ec9387a4609f58dd4c7,
    payload: 0x0c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f6164020000007a0c0000000406706172616d7302000000010008746f6b656e2d696402000000205542c30f716fcc22e48a4836aa9431766a24f201489a3a040a2401ec9ccbfa9d12746f6b656e2d6d616e616765722d7479706501000000000000000000000000000000020474797065010000000000000000000000000000000204747970650100000000000000000000000000000003,
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service,
    }
```

```ts
import { cvToJSON, hexToCV, Cl } from "@stacks/transactions";

const hex =
  "0x0c000000061164657374696e6174696f6e2d636861696e0d000000066178656c61721c64657374696e6174696f6e2d636f6e74726163742d616464726573730d00000008636f736d7761736d077061796c6f616402000000c10c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f6164020000007a0c0000000406706172616d7302000000010008746f6b656e2d69640200000020c99a1f0a4b46456129d86b37f580af16fea20eeaf7e73628547c10f6799b90b012746f6b656e2d6d616e616765722d74797065010000000000000000000000000000000204747970650100000000000000000000000000000002047479706501000000000000000000000000000000030c7061796c6f61642d6861736802000000209ce89d392d43333d269dd9f234e765ded79db1ba895e8b2e3d6d8f936cae57320673656e646572061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce18696e746572636861696e2d746f6b656e2d7365727669636504747970650d0000000d636f6e74726163742d63616c6c";

const json = cvToJSON(hexToCV(hex));

console.log("type:", json.value["type"].value);
console.log("destination-chain:", json.value["destination-chain"].value);
console.log(
  "destination-contract-address:",
  json.value["destination-contract-address"].value
);
console.log("payload:", json.value["payload"].value);
console.log("payload-hash:", json.value["payload-hash"].value);
console.log("sender:", json.value["sender"].value);
console.log(
  "decoded-wrapped-payload,",
  Cl.prettyPrint(hexToCV(json.value["payload"].value))
);
```

output:

```
'type:' 'contract-call'
'destination-chain:' 'axelar'
'destination-contract-address:' 'cosmwasm'
'payload:' '0x0c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f6164020000007a0c0000000406706172616d7302000000010008746f6b656e2d69640200000020c99a1f0a4b46456129d86b37f580af16fea20eeaf7e73628547c10f6799b90b012746f6b656e2d6d616e616765722d7479706501000000000000000000000000000000020474797065010000000000000000000000000000000204747970650100000000000000000000000000000003'
'payload-hash:' '0x9ce89d392d43333d269dd9f234e765ded79db1ba895e8b2e3d6d8f936cae5732'
'sender:' 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service'
'decoded-wrapped-payload,' '{ destination-chain: "ethereum", payload: 0x0c0000000406706172616d7302000000010008746f6b656e2d69640200000020c99a1f0a4b46456129d86b37f580af16fea20eeaf7e73628547c10f6799b90b012746f6b656e2d6d616e616765722d74797065010000000000000000000000000000000204747970650100000000000000000000000000000002, type: u3 }'
```
