# Gateway Contract

## Interface

```clarity
(define-public (call-contract 
    (destination-chain (string-ascii 32)) 
    (destination-contract-address (string-ascii 48)) 
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
    (source-chain (string-ascii 32)) 
    (message-id (string-ascii 71)) 
    (source-address (string-ascii 48)) 
    (payload-hash (buff 32))
) 
```

```clarity
(define-read-only (is-message-approved 
    (source-chain (string-ascii 32))
    (message-id (string-ascii 71))
    (source-address (string-ascii 48)) 
    (contract-address principal) 
    (payload-hash (buff 32))
)
```

```clarity
(define-read-only (is-message-executed
    (source-chain (string-ascii 32))
    (message-id (string-ascii 71))
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
        source-chain: (string-ascii 32),
        message-id: (string-ascii 71),
        source-address: (string-ascii 48),
        contract-address: principal,
        payload-hash: (buff 32)
    })
```

Serialization example: 

```js
import { bufferCV, stringAsciiCV, listCV, serializeCV, tupleCV, bufferFromHex } from "@stacks/transactions";

const messages = bufferCV(
    serializeCV(
        listCV(
            [
                tupleCV({
                    "source-chain": stringAsciiCV("ethereum"),
                    "message-id": stringAsciiCV("210d370a7aa448c50d2efa7b1df884da31c9f43aa8e9763df087bb5c592058c5-0"),
                    "source-address": bufferFromHex("000Ec41d91A35048FbA4F00522Be80DF0E39e785"),
                    "contract-address": bufferFromHex("000F9B4FF55aFcC3C4f9f325EE890c0C806E8FCC"),
                    "payload-hash": bufferFromHex("0ceb6cf5466ce364a10d9e045726eb10f01667b8c0a1293ae4ae43baee439833")
                }),
                tupleCV({
                    "source-chain": stringAsciiCV("ethereum"),
                    "message-id": stringAsciiCV("fe0d2393e76ea487217b1606aff64535f8526a00e007704f8391fa41c78fb451-0"),
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
    signers: (list 48 {signer: (buff 33), weight: uint}), 
    threshold: uint, 
    nonce: (buff 32) 
}
```

Serialization example: 

```js

import { bufferCV, listCV, principalCV, serializeCV, tupleCV, uintCV, bufferFromHex } from "@stacks/transactions";

const signers = bufferCV(
    serializeCV(
        tupleCV({
            "signers": listCV([
                tupleCV({
                    "signer": bufferFromHex("02acd623205fb9f264b0b483a94269a814c0e1a3396308a08b739ee401d474c3ef"),
                    "weight": uintCV(1)
                }),
                tupleCV({
                    "signer": bufferFromHex("02e2f437a4231244bc185ce4ba5f9638d039e4337af71d280c3c366159e6d7bedc"),
                    "weight": uintCV(2)
                }),
                tupleCV({
                    "signer": bufferFromHex("03a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d7"),
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
        signers: (list 48 {signer: (buff 33), weight: uint}), 
        threshold: uint, 
        nonce: (buff 32) 
    },
    signatures: (list 48 (buff 65))
}
```

Serialization example: 

```js
import { bufferCV, listCV, principalCV, serializeCV, tupleCV, uintCV, bufferFromHex } from "@stacks/transactions";

const proof = bufferCV(
    serializeCV(
        tupleCV({
            "signers": tupleCV({
                "signers": listCV([
                    tupleCV({
                        "signer": bufferFromHex("02acd623205fb9f264b0b483a94269a814c0e1a3396308a08b739ee401d474c3ef"),
                        "weight": uintCV(1)
                    }),
                    tupleCV({
                        "signer": bufferFromHex("02e2f437a4231244bc185ce4ba5f9638d039e4337af71d280c3c366159e6d7bedc"),
                        "weight": uintCV(2)
                    }),
                    tupleCV({
                        "signer": bufferFromHex("03a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d7"),
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
    destination-chain: (string-ascii 32),
    destination-contract-address: (string-ascii 48),
    payload-hash: (buff 32),
    payload: (buff 10240)
}
```

Deserialization function: [contractCallEventToObj](./tests/util.ts#L148)

### message-approved
```clarity
{
    type: "message-approved",
    command-id: (buff 32),
    source-chain: (string-ascii 32), 
    message-id: (string-ascii 71),
    source-address: (string-ascii 48), 
    contract-address: principal,
    payload-hash: (buff 32)
}
```

Deserialization function: [messageApprovedEventToObj](./tests/util.ts#L161)

### message-executed
```clarity
{
    type: "message-executed",
    command-id: (buff 32),
    source-chain: (string-ascii 32), 
    message-id: (string-ascii 71)
}
```

Deserialization function: [messageExecutedEventToObj](./tests/util.ts#L175)

### signers-rotated
```clarity
{
    type: "signers-rotated",
    epoch: uint,
    signers-hash: (buff 32), 
    signers: (buff 2048)
}
```


Deserialization function: [signersRotatedEventToObj](./tests/util.ts#L186)