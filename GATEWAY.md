# Gateway Contract

## Interface

```clarity
(define-public (call-contract 
    (destination-chain (buff 18)) 
    (destination-contract-address (buff 96)) 
    (payload (buff 10240))
)
```

```clarity
(define-public (approve-messages 
    (messages (buff 4096)) ;; Serialized buff data from Messages type
    (proof (buff 7168)) ;; Serialized buff data from Proof type
)
```


```clarity
(define-public (validate-message 
    (source-chain (buff 18)) 
    (message-id (buff 32)) 
    (source-address (buff 96)) 
    (payload-hash (buff 32))
) 
```

```clarity
(define-read-only (is-message-approved 
    (source-chain (buff 18))
    (message-id (buff 32))
    (source-address (buff 96)) 
    (contract-address (buff 96)) 
    (payload-hash (buff 32))
)
```

```clarity
(define-read-only (is-message-executed
    (source-chain (buff 18))
    (message-id (buff 32))
) 
```

```clarity
(define-public (rotate-signers 
    (new-signers (buff 4096)) ;; Serialized buff data from Signers type
    (proof (buff 7168)) ;; Serialized buff data from Proof type
)
```

## Types

### Messages
```clarity
    (list 10 {
        source-chain: (buff 18),
        message-id: (buff 32),
        source-address: (buff 96),
        contract-address: (buff 96),
        payload-hash: (buff 32)
    })
```

Serialization example: 

```js
import { bufferCV, bufferCVFromString, listCV, serializeCV, tupleCV, bufferFromHex, bufferFromAscii } from "@stacks/transactions";

const messages = bufferCV(
    serializeCV(
        listCV(
            [
                tupleCV({
                    "source-chain": bufferCVFromString("ethereum"),
                    "message-id": bufferFromHex("210d370a7aa448c50d2efa7b1df884da31c9f43aa8e9763df087bb5c592058c5"),
                    "source-address": bufferFromHex("000Ec41d91A35048FbA4F00522Be80DF0E39e785"),
                    "contract-address": bufferFromHex("000F9B4FF55aFcC3C4f9f325EE890c0C806E8FCC"),
                    "payload-hash": bufferFromHex("0ceb6cf5466ce364a10d9e045726eb10f01667b8c0a1293ae4ae43baee439833")
                }),
                tupleCV({
                    "source-chain": bufferCVFromString("ethereum"),
                    "message-id": bufferFromHex("fe0d2393e76ea487217b1606aff64535f8526a00e007704f8391fa41c78fb451"),
                    "source-address": bufferFromHex("000E91D671C29c2DBBc81D16adA4a8bDd6fE518F"),
                    "contract-address": bufferFromHex("000D56AA59a39557B62584CEEaF00a55d426E3a3"),
                    "payload-hash": bufferFromHex("dab0a0dbe44a3789aab44865f310d59df48c068855d112686bd6359d737aa422")
                })
            ]
        )
    )
)
```


### Signers
```clarity
{ 
    signers: (list 32 {signer: principal, weight: uint}), 
    threshold: uint, 
    nonce: (buff 32) 
}
```

Serialization example: 

```js

import { bufferCV, bufferCVFromString, listCV, principalCV, serializeCV, tupleCV, uintCV, bufferFromAscii, bufferFromHex  } from "@stacks/transactions";

const signers = bufferCV(
    serializeCV(
        tupleCV({
            "signers": listCV([
                tupleCV({
                    "signer": principalCV("SP31SWB58Q599WE8YP6BEJP3XD3QMBJJ7534HSCZV"),
                    "weight": uintCV(1)
                }),
                tupleCV({
                    "signer": principalCV("SP1H6WMP29RXTQQCB3QSA146P6SR7G59BVHTTKWCC"),
                    "weight": uintCV(2)
                }),
                tupleCV({
                    "signer": principalCV("SP1N6CA5FQPE8PH1MK074YA8XQJZYPS8D56GKS9W6"),
                    "weight": uintCV(2)
                }),
            ]),
            "threshold": uintCV(3),
            "nonce": bufferFromHex("11228e4ef3805b921c2a5062537ebcb8bff5635c72f5ec6950c8c37c0cad8669")
        })
    )
)
```

### Proof 
```clarity
{ 
    signers: {
        signers: (list 32 {signer: principal, weight: uint}), 
        threshold: uint, 
        nonce: (buff 32) 
    },
    signatures: (list 32 (buff 65))
}
```

Serialization example: 

```js
import { bufferCV, bufferCVFromString, listCV, principalCV, serializeCV, tupleCV, uintCV, bufferFromAscii, bufferFromHex } from "@stacks/transactions";

const proof = bufferCV(
    serializeCV(
        tupleCV({
            "signers": tupleCV({
                "signers": listCV([
                    tupleCV({
                        "signer": principalCV("SP31SWB58Q599WE8YP6BEJP3XD3QMBJJ7534HSCZV"),
                        "weight": uintCV(1)
                    }),
                    tupleCV({
                        "signer": principalCV("SP1H6WMP29RXTQQCB3QSA146P6SR7G59BVHTTKWCC"),
                        "weight": uintCV(2)
                    }),
                    tupleCV({
                        "signer": principalCV("SP1N6CA5FQPE8PH1MK074YA8XQJZYPS8D56GKS9W6"),
                        "weight": uintCV(2)
                    }),
                ]),
                "threshold": uintCV(3),
                "nonce": bufferFromHex("11228e4ef3805b921c2a5062537ebcb8bff5635c72f5ec6950c8c37c0cad8669")
            }),
            "signatures": listCV([
                bufferFromHex("afb485bfd1a3e087d9bd9053640e915d009a11056cb7a7330285dab72e27b45c9796a66e2b149a068f1222fcc4cce4572dccae6ae86f3e0281bda2e404030f5a"),
                bufferFromHex("c2e42eb433d56996de35c20fdba1a07fcabaa0a3a0d66211df12dcd2bfae3280fa126906a6855657e73111b16b706151960c7b1bab3cc3318d9b95cdec564a41")
            ])
        })
    )
)
```

## Events

### contract-call
```clarity
{
    type: "contract-call",
    sender: principal,
    destination-chain: (buff 18),
    destination-contract-address: (buff 96),
    payload-hash: (buff 32),
    payload: (buff 10240)
}
```

Deserialization example: 

*with below contract call parameters*:
```
// bufferCVFromString("ethereum")
destination-chain: 0x657468657265756d 

// bufferFromHex("0x043E105189e15AC72252CFEF898EC3841A4A0561")
destination-contract-address: 0x307830343345313035313839653135414337323235324346454638393845433338343141344130353631 

// bufferCVFromString("loremipsum dolor sit amet")
payload: 0x6c6f72656d697073756d20646f6c6f722073697420616d6574 
```

```js

import { cvToJSON, deserialize } from "@stacks/transactions";

const hex = "0x0c000000061164657374696e6174696f6e2d636861696e0200000008657468657265756d1c64657374696e6174696f6e2d636f6e74726163742d61646472657373020000002a307830343345313035313839653135414337323235324346454638393845433338343141344130353631077061796c6f616402000000196c6f72656d697073756d20646f6c6f722073697420616d65740c7061796c6f61642d6861736802000000200338573718f5cd6d7e5a90adcdebd28b097f99574ad6febffea9a40adb17f46d0673656e646572051a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce04747970650d0000000d636f6e74726163742d63616c6c";

const json = cvToJSON(deserialize(hex));

console.log('type:', json.value['type'].value);
console.log('sender:', json.value['sender'].value)
console.log('destination-chain:', Buffer.from(json.value['destination-chain'].value.replace('0x', ''), 'hex').toString('ascii'))
console.log('destination-contract-address:', Buffer.from(json.value['destination-contract-address'].value.replace('0x', ''), 'hex').toString('ascii'))
console.log('payload:', Buffer.from(json.value['payload'].value.replace('0x', ''), 'hex').toString('ascii'))
console.log('payload-hash:', json.value['payload-hash'].value)
```

output:

```
type: contract-call
sender: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
destination-chain: ethereum
destination-contract-address: 0x043E105189e15AC72252CFEF898EC3841A4A0561
payload: loremipsum dolor sit amet
payload-hash: 0x0338573718f5cd6d7e5a90adcdebd28b097f99574ad6febffea9a40adb17f46d
```

### message-approved
```clarity
{
    type: "message-approved",
    command-id: (buff 32),
    source-chain: (buff 18), 
    message-id: (buff 32),
    source-address: (buff 96), 
    contract-address: (buff 96),
    payload-hash: (buff 32)
}
```

### message-executed
```clarity
{
    type: "message-executed",
    command-id: (buff 32),
    source-chain: (buff 18), 
    message-id: (buff 32)
}
```

### signers-rotated
```clarity
{
    type: "signers-rotated",
    epoch: uint,
    signers-hash: (buff 32), 
    signers: (buff 2048)
}
```