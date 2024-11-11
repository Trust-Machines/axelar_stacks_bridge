# Interchain Token Service Contract

## Public Functions

### 1. `set-paused`

Sets the paused status of the contract.

```clarity
(define-public (set-paused
  (its-impl <its-trait>) (status bool))
```

### 2. `transfer-operatorship`

Transfers operatorship to a new account.

```clarity
(define-public (transfer-operatorship
    (its-impl <its-trait>) (new-operator principal))
```

### 3. `set-trusted-address`

Sets the trusted address for a given chain.

```clarity
(define-public (set-trusted-address
  (its-impl <its-trait>)
  (chain-name (string-ascii 20))
  (address (string-ascii 128)))
```

### 4. `remove-trusted-address`

Removes the trusted address for a given chain.

```clarity
(define-public (remove-trusted-address
    (its-impl <its-trait>)
    (chain-name (string-ascii 32))))
```

### 5. `deploy-token-manager`

Deploys a token manager on a destination chain.

```clarity
(define-public (deploy-token-manager
            (gateway-impl <gateway-trait>)
            (its-impl <its-trait>)
            (salt (buff 32))
            (destination-chain (string-ascii 32))
            (token-manager-type uint)
            (token <sip-010-trait>)
            (token-manager <token-manager-trait>)
            (gas-value uint)))
```

### 6. `process-deploy-token-manager-from-stacks`

Executes the enable token process.

```clarity
(define-public (process-deploy-token-manager-from-stacks
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (message-id (string-ascii 128))
        (source-chain (string-ascii 32))
        (source-address (string-ascii 128))
        (payload (buff 1024))))
```
### 7. `process-deploy-token-manager-from-external-chain`

Starts the verification process for a token manager contract deployment before deploying on stacks.

```clarity
(define-public (process-deploy-token-manager-from-external-chain
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token-manager <token-manager-trait>)
        (payload (buff 63000))
        (wrapped-payload  (optional {
            source-chain: (string-ascii 20),
            source-address: (string-ascii 128),
            message-id: (string-ascii 128),
            payload: (buff 63000),
        }))
        (gas-value uint))
```

### 8. `process-deploy-token-manager-from-stacks`

Validates the token manager was vereified and ready to be deployed on stacks.

```clarity
(define-public (process-deploy-token-manager-from-stacks
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (message-id (string-ascii 128))
        (source-chain (string-ascii 20))
        (source-address (string-ascii 128))
        (payload (buff 64000)))
```

### 9. `deploy-remote-interchain-token`

Deploys an interchain token on a destination chain.

```clarity
(define-public (deploy-remote-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt (buff 32))
        (destination-chain (string-ascii 20))
        (name (string-ascii 32))
        (symbol (string-ascii 32))
        (decimals uint)
        (minter (buff 128))
        (gas-value uint))
```

### 10. `deploy-interchain-token`

Deploys an interchain token on a destination chain.

```clarity
(define-public (deploy-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (salt (buff 32))
        (destination-chain (string-ascii 32))
        (name (string-ascii 32))
        (symbol (string-ascii 32))
        (decimals uint)
        (minter (buff 32))
        (gas-value uint)))
```

### 11. `interchain-transfer`

Initiates an interchain transfer of a specified token to a destination chain.

```clarity
(define-public (interchain-transfer
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 32))
        (destination-address (buff 100))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 1024)
        })
        (gas-value uint)))
```

### 12. `call-contract-with-interchain-token`

Calls a contract on a destination chain with an interchain token.

```clarity
(define-public (call-contract-with-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (token-id (buff 32))
        (destination-chain (string-ascii 32))
        (destination-address (buff 100))
        (amount uint)
        (metadata {
            version: uint,
            data: (buff 1024)
        })
        (gas-value uint)))
```

### 13. `execute-deploy-token-manager`

Based on the source chain deteremines whethere to verify or validate token manager deployment.

```clarity
(define-public (execute-deploy-token-manager
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (source-chain (string-ascii 20))
        (message-id (string-ascii 128))
        (source-address (string-ascii 128))
        (payload (buff 63000))
        (token <sip-010-trait>)
        (token-manager <token-manager-trait>)
        (gas-value uint))
```

### 14. `execute-deploy-interchain-token`

Executes the deployment of an interchain token.

```clarity
(define-public (execute-deploy-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (message-id (string-ascii 128))
        (source-chain (string-ascii 32))
        (source-address (string-ascii 128))
        (token-address principal)
        (payload (buff 1024))))
```

### 15. `execute-receive-interchain-token`

Executes the receipt of an interchain token.

```clarity
(define-public (execute-receive-interchain-token
        (gateway-impl <gateway-trait>)
        (its-impl <its-trait>)
        (message-id (string-ascii 128))
        (source-chain (string-ascii 32))
        (token-manager <token-manager-trait>)
        (token <sip-010-trait>)
        (destination-contract <interchain-token-executable-trait>)
        (payload (buff 1024))))
```

### 16. `set-flow-limit`

Sets the flow limit for a specific token manager.

```clarity
(define-public (set-flow-limit
    (its-impl <its-trait>)
    (token-id (buff 32))
    (token-manager <token-manager-trait>)
    (limit uint))
```

### 17. `upgrade-impl`

Upgrades the implementation of the interchain token service contract.

```clarity
(define-public (upgrade-impl
    (its-impl <its-trait>))
```

### 18. `setup`

Sets up the interchain token service contract.

```clarity
(define-public (setup
    (its-contract-address-name (string-ascii 128))
    (interchain-token-factory-address principal)
    (gateway-address principal)
    (gas-service-address principal)
    (operator-address principal)
    (trusted-chain-names-addresses (list 50 {chain-name: (string-ascii 32), address: (string-ascii 128)}))
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
    chain: (string-ascii 128),
    address: principal
}
```

### 3. `trusted-address-removed`

Emitted when a trusted address is removed for a chain.

```clarity
{
    type: "trusted-address-removed",
    chain: (string-ascii 128)
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
    destination-chain: (string-ascii 32),
}
```

### 7. `interchain-transfer`

Emitted when an interchain transfer is initiated.

```clarity
{
    type: "interchain-transfer",
    token-id: (buff 32),
    source-address: principal,
    destination-chain: (string-ascii 32),
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
    source-chain: (string-ascii 32),
    source-address: (string-ascii 128),
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

Deploy remote interchain token:

```clarity
{
    type: "contract-call",
    destination-chain: "axelar",
    destination-contract-address: "cosmwasm",
    payload-hash: 0xd43fb458860984847ad52f4395cfda8aa6fdb7a4cde7d2de36caa51ff2532617, payload: 0x0c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f616402000000920c0000000608646563696d616c730100000000000000000000000000000006066d696e746572020000000100046e616d650d0000000673616d706c650673796d626f6c0d0000000673616d706c6508746f6b656e2d69640200000020d6217727e786ecf249d79ae4b3f6f67ee585ec34f2b1e769ab83b13416d669d50474797065010000000000000000000000000000000104747970650100000000000000000000000000000003,
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service,
    }
```

```ts
import {
  cvToJSON,
  hexToCV,
  Cl,
  TupleCV,
  StringAsciiCV,
  BufferCV,
  UIntCV,
} from "@stacks/transactions";

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
console.log(
  "decoded-wrapped-wrapped-payload,",
  Cl.prettyPrint(
    hexToCV(
      Cl.prettyPrint(
        (
          hexToCV(json.value["payload"].value) as TupleCV<{
            "destination-chain": StringAsciiCV;
            payload: BufferCV;
            type: UIntCV;
          }>
        ).data.payload
      )
    )
  )
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
'decoded-wrapped-wrapped-payload,' '{ decimals: u6, minter: 0x00, name: "sample", symbol: "sample", token-id: 0xd6217727e786ecf249d79ae4b3f6f67ee585ec34f2b1e769ab83b13416d669d5, type: u1 }'
```

Deploy remote token manager:

```clarity
{
    type: "contract-call",
    destination-chain: "axelar",
    destination-contract-address: "cosmwasm",
    payload-hash: 0x9ce89d392d43333d269dd9f234e765ded79db1ba895e8b2e3d6d8f936cae5732,
    payload: 0x0c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f6164020000007a0c0000000406706172616d7302000000010008746f6b656e2d69640200000020c99a1f0a4b46456129d86b37f580af16fea20eeaf7e73628547c10f6799b90b012746f6b656e2d6d616e616765722d7479706501000000000000000000000000000000020474797065010000000000000000000000000000000204747970650100000000000000000000000000000003,
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service,
}
```

```ts
import {
  cvToJSON,
  hexToCV,
  Cl,
  TupleCV,
  StringAsciiCV,
  BufferCV,
  UIntCV,
} from "@stacks/transactions";

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
console.log(
  "decoded-wrapped-wrapped-payload,",
  Cl.prettyPrint(
    hexToCV(
      Cl.prettyPrint(
        (
          hexToCV(json.value["payload"].value) as TupleCV<{
            "destination-chain": StringAsciiCV;
            payload: BufferCV;
            type: UIntCV;
          }>
        ).data.payload
      )
    )
  )
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
'decoded-wrapped-wrapped-payload,' '{ params: 0x00, token-id: 0xc99a1f0a4b46456129d86b37f580af16fea20eeaf7e73628547c10f6799b90b0, token-manager-type: u2, type: u2 }'
```

Interchain transfer:

```clarity
{
  type: "contract-call",
  destination-chain: "axelar",
  destination-contract-address: "cosmwasm",
  payload-hash: 0x3dc0763c57c9c7912d2c072718e6ef2ae2d595ce2da31d8b248205d67ad7c3ab,
  payload: 0x0c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f616402000000ab0c0000000606616d6f756e7401000000000000000000000000000186a004646174610200000001001364657374696e6174696f6e2d616464726573730200000001000e736f757263652d61646472657373051a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce08746f6b656e2d69640200000020753306c46380848b5189cd9db90107b15d25decccd93dcb175c0098958f18b6f0474797065010000000000000000000000000000000004747970650100000000000000000000000000000003,
  sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service,
}

```

```ts
import {
  cvToJSON,
  hexToCV,
  Cl,
  TupleCV,
  StringAsciiCV,
  BufferCV,
  UIntCV,
} from "@stacks/transactions";

const hex =
  "0x0c000000061164657374696e6174696f6e2d636861696e0d000000066178656c61721c64657374696e6174696f6e2d636f6e74726163742d616464726573730d00000008636f736d7761736d077061796c6f616402000000f20c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f616402000000ab0c0000000606616d6f756e7401000000000000000000000000000186a004646174610200000001001364657374696e6174696f6e2d616464726573730200000001000e736f757263652d61646472657373051a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce08746f6b656e2d69640200000020753306c46380848b5189cd9db90107b15d25decccd93dcb175c0098958f18b6f04747970650100000000000000000000000000000000047479706501000000000000000000000000000000030c7061796c6f61642d6861736802000000203dc0763c57c9c7912d2c072718e6ef2ae2d595ce2da31d8b248205d67ad7c3ab0673656e646572061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce18696e746572636861696e2d746f6b656e2d7365727669636504747970650d0000000d636f6e74726163742d63616c6c";

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
console.log(
  "decoded-wrapped-wrapped-payload,",
  Cl.prettyPrint(
    hexToCV(
      Cl.prettyPrint(
        (
          hexToCV(json.value["payload"].value) as TupleCV<{
            "destination-chain": StringAsciiCV;
            payload: BufferCV;
            type: UIntCV;
          }>
        ).data.payload
      )
    )
  )
);
```

output:

```
'type:' 'contract-call'
'destination-chain:' 'axelar'
'destination-contract-address:' 'cosmwasm'
'payload:' '0x0c000000031164657374696e6174696f6e2d636861696e0d00000008657468657265756d077061796c6f616402000000ab0c0000000606616d6f756e7401000000000000000000000000000186a004646174610200000001001364657374696e6174696f6e2d616464726573730200000001000e736f757263652d61646472657373051a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce08746f6b656e2d69640200000020753306c46380848b5189cd9db90107b15d25decccd93dcb175c0098958f18b6f0474797065010000000000000000000000000000000004747970650100000000000000000000000000000003'
'payload-hash:' '0x3dc0763c57c9c7912d2c072718e6ef2ae2d595ce2da31d8b248205d67ad7c3ab'
'sender:' 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service'
'decoded-wrapped-payload,' '{ destination-chain: "ethereum", payload: 0x0c0000000606616d6f756e7401000000000000000000000000000186a004646174610200000001001364657374696e6174696f6e2d616464726573730200000001000e736f757263652d61646472657373051a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce08746f6b656e2d69640200000020753306c46380848b5189cd9db90107b15d25decccd93dcb175c0098958f18b6f04747970650100000000000000000000000000000000, type: u3 }'
'decoded-wrapped-wrapped-payload,' "{ amount: u100000, data: 0x00, destination-address: 0x00, source-address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM, token-id: 0x753306c46380848b5189cd9db90107b15d25decccd93dcb175c0098958f18b6f, type: u0 }"
```

Verify Interchain Token:

```clarity
{
  type: "contract-call",
  destination-chain: "stacks",
  destination-contract-address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service",
  payload-hash: 0xe0a3c74b09fa9fc9ce46ab8b6984ffb079f49fc08862a949a14a6eb6ad063c75,
  payload: 0x0c000000080a6d6573736167652d69640d0000002c617070726f7665642d696e746572636861696e2d746f6b656e2d6465706c6f796d656e742d6d657373616765077061796c6f616402000000a60c0000000608646563696d616c7301000000000000000000000000000000120c6d696e7465722d6279746573020000000100046e616d650d000000176e61746976652d696e746572636861696e2d746f6b656e0673796d626f6c0d0000000349545408746f6b656e2d696402000000206c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a850372047479706501000000000000000000000000000000010e736f757263652d616464726573730d00000004307830300c736f757263652d636861696e0d00000008657468657265756d0d746f6b656e2d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0e73616d706c652d7369702d30313008746f6b656e2d696402000000206c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a8503720a746f6b656e2d74797065010000000000000000000000000000000004747970650d000000177665726966792d696e746572636861696e2d746f6b656e,
  sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service,
}
```

```ts
import {
  cvToJSON,
  hexToCV,
  Cl,
  TupleCV,
  StringAsciiCV,
  BufferCV,
  UIntCV,
} from "@stacks/transactions";

const hex =
  "0x0c000000061164657374696e6174696f6e2d636861696e0d00000006737461636b731c64657374696e6174696f6e2d636f6e74726163742d616464726573730d00000042535431505148514b5630524a585a465931444758384d4e534e5956453356475a4a53525450475a474d2e696e746572636861696e2d746f6b656e2d73657276696365077061796c6f616402000001c40c000000080a6d6573736167652d69640d0000002c617070726f7665642d696e746572636861696e2d746f6b656e2d6465706c6f796d656e742d6d657373616765077061796c6f616402000000a60c0000000608646563696d616c7301000000000000000000000000000000120c6d696e7465722d6279746573020000000100046e616d650d000000176e61746976652d696e746572636861696e2d746f6b656e0673796d626f6c0d0000000349545408746f6b656e2d696402000000206c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a850372047479706501000000000000000000000000000000010e736f757263652d616464726573730d00000004307830300c736f757263652d636861696e0d00000008657468657265756d0d746f6b656e2d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0e73616d706c652d7369702d30313008746f6b656e2d696402000000206c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a8503720a746f6b656e2d74797065010000000000000000000000000000000004747970650d000000177665726966792d696e746572636861696e2d746f6b656e0c7061796c6f61642d686173680200000020e0a3c74b09fa9fc9ce46ab8b6984ffb079f49fc08862a949a14a6eb6ad063c750673656e646572061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce18696e746572636861696e2d746f6b656e2d7365727669636504747970650d0000000d636f6e74726163742d63616c6c";

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
console.log(
  "decoded-wrapped-wrapped-payload,",
  Cl.prettyPrint(
    hexToCV(
      Cl.prettyPrint(
        (
          hexToCV(json.value["payload"].value) as TupleCV<{
            "destination-chain": StringAsciiCV;
            payload: BufferCV;
            type: UIntCV;
          }>
        ).data.payload
      )
    )
  )
);
```

output:

```
'type:' 'contract-call'
'destination-chain:' 'stacks'
'destination-contract-address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service'
'payload:' '0x0c000000080a6d6573736167652d69640d0000002c617070726f7665642d696e746572636861696e2d746f6b656e2d6465706c6f796d656e742d6d657373616765077061796c6f616402000000a60c0000000608646563696d616c7301000000000000000000000000000000120c6d696e7465722d6279746573020000000100046e616d650d000000176e61746976652d696e746572636861696e2d746f6b656e0673796d626f6c0d0000000349545408746f6b656e2d696402000000206c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a850372047479706501000000000000000000000000000000010e736f757263652d616464726573730d00000004307830300c736f757263652d636861696e0d00000008657468657265756d0d746f6b656e2d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0e73616d706c652d7369702d30313008746f6b656e2d696402000000206c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a8503720a746f6b656e2d74797065010000000000000000000000000000000004747970650d000000177665726966792d696e746572636861696e2d746f6b656e'
'payload-hash:' '0xe0a3c74b09fa9fc9ce46ab8b6984ffb079f49fc08862a949a14a6eb6ad063c75'
'sender:' 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service'
'decoded-wrapped-payload,' `{ message-id: "approved-interchain-token-deployment-message", payload: 0x0c0000000608646563696d616c7301000000000000000000000000000000120c6d696e7465722d6279746573020000000100046e616d650d000000176e61746976652d696e746572636861696e2d746f6b656e0673796d626f6c0d0000000349545408746f6b656e2d696402000000206c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a85037204747970650100000000000000000000000000000001, source-address: "0x00", source-chain: "ethereum", token-address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sample-sip-010, token-id: 0x6c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a850372, token-type: u0, type: "verify-interchain-token" }`
'decoded-wrapped-wrapped-payload,' '{ decimals: u18, minter-bytes: 0x00, name: "native-interchain-token", symbol: "ITT", token-id: 0x6c96e90b60cd71d0b948ae26be1046377a10f46441d595a6d5dd4f4a6a850372, type: u1 }'
```

Verify Token manager:

```clarity
{
  type: "contract-call",
  destination-chain: "stacks",
  destination-contract-address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service",
  payload-hash: 0x8488259c3537e21e92750cc757a4b99377c5149ea986e2eff7716fdaf8c4ace8,
  payload: 0x0c000000050d746f6b656e2d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0e73616d706c652d7369702d30313008746f6b656e2d69640200000020289df9e77347122b6306bc2db1fa9387bb8b851d685ff3ee92d18335abd1c10c15746f6b656e2d6d616e616765722d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0d746f6b656e2d6d616e616765720a746f6b656e2d74797065010000000000000000000000000000000204747970650d000000147665726966792d746f6b656e2d6d616e61676572,
  sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service,
}
```

```ts
import { cvToJSON, hexToCV, Cl } from "@stacks/transactions";

const hex =
  "0x0c000000061164657374696e6174696f6e2d636861696e0d00000006737461636b731c64657374696e6174696f6e2d636f6e74726163742d616464726573730d00000042535431505148514b5630524a585a465931444758384d4e534e5956453356475a4a53525450475a474d2e696e746572636861696e2d746f6b656e2d73657276696365077061796c6f616402000000da0c000000050d746f6b656e2d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0e73616d706c652d7369702d30313008746f6b656e2d69640200000020289df9e77347122b6306bc2db1fa9387bb8b851d685ff3ee92d18335abd1c10c15746f6b656e2d6d616e616765722d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0d746f6b656e2d6d616e616765720a746f6b656e2d74797065010000000000000000000000000000000204747970650d000000147665726966792d746f6b656e2d6d616e616765720c7061796c6f61642d6861736802000000208488259c3537e21e92750cc757a4b99377c5149ea986e2eff7716fdaf8c4ace80673656e646572061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce18696e746572636861696e2d746f6b656e2d7365727669636504747970650d0000000d636f6e74726163742d63616c6c";

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
'destination-chain:' 'stacks'
'destination-contract-address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service'
'payload:' '0x0c000000050d746f6b656e2d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0e73616d706c652d7369702d30313008746f6b656e2d69640200000020289df9e77347122b6306bc2db1fa9387bb8b851d685ff3ee92d18335abd1c10c15746f6b656e2d6d616e616765722d61646472657373061a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce0d746f6b656e2d6d616e616765720a746f6b656e2d74797065010000000000000000000000000000000204747970650d000000147665726966792d746f6b656e2d6d616e61676572'
'payload-hash:' '0x8488259c3537e21e92750cc757a4b99377c5149ea986e2eff7716fdaf8c4ace8'
'sender:' 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.interchain-token-service'
'decoded-wrapped-payload,' `{ token-address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sample-sip-010, token-id: 0x289df9e77347122b6306bc2db1fa9387bb8b851d685ff3ee92d18335abd1c10c, token-manager-address: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-manager, token-type: u2, type: "verify-token-manager" }`
```
