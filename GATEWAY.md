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
import { bufferCV, stringAsciiCV, listCV, serializeCV, tupleCV } from "@stacks/transactions";
import { bufferFromHex } from "@stacks/transactions/dist/cl";

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

import { bufferCV, listCV, principalCV, serializeCV, tupleCV, uintCV } from "@stacks/transactions";
import {bufferFromHex} from "@stacks/transactions/dist/cl"

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
import { bufferCV, listCV, principalCV, serializeCV, tupleCV, uintCV } from "@stacks/transactions";
import {bufferFromHex} from "@stacks/transactions/dist/cl"

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

import { cvToJSON, hexToCV } from "@stacks/transactions";

const hex = "0x0c000000061164657374696e6174696f6e2d636861696e0200000008657468657265756d1c64657374696e6174696f6e2d636f6e74726163742d61646472657373020000002a307830343345313035313839653135414337323235324346454638393845433338343141344130353631077061796c6f616402000000196c6f72656d697073756d20646f6c6f722073697420616d65740c7061796c6f61642d6861736802000000200338573718f5cd6d7e5a90adcdebd28b097f99574ad6febffea9a40adb17f46d0673656e646572051a6d78de7b0625dfbfc16c3a8a5735f6dc3dc3f2ce04747970650d0000000d636f6e74726163742d63616c6c";

const json = cvToJSON(hexToCV(hex));

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
    source-chain: (string-ascii 32), 
    message-id: (string-ascii 71),
    source-address: (string-ascii 48), 
    contract-address: principal,
    payload-hash: (buff 32)
}
```

### message-executed
```clarity
{
    type: "message-executed",
    command-id: (buff 32),
    source-chain: (string-ascii 32), 
    message-id: (string-ascii 71)
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

Deserialization example: 

```js

import { cvToJSON, hexToCV } from "@stacks/transactions";

const hex = "0x0c000000040565706f63680100000000000000000000000000000002077369676e6572730c00000003056e6f6e6365020000000132077369676e6572730b000000040c00000002067369676e657202000000210277ad46cf1f82953116604c137c41d11fc095694d046417820a3d77253363b9040677656967687401000000000000000000000000000000010c00000002067369676e65720200000021031244d4c729f83c9e7898a85283e7460783a711746ba2ff24767443109ae1e64f0677656967687401000000000000000000000000000000010c00000002067369676e6572020000002103a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d70677656967687401000000000000000000000000000000010c00000002067369676e657202000000210319ea093014a1cc7f4aa0219506c20bc1de1480ea157b9b28a088d5f8a70e63cb067765696768740100000000000000000000000000000001097468726573686f6c6401000000000000000000000000000000030c7369676e6572732d6861736802000000207146e0383fc88d294cdfde2685895a88f56d34c46f3e2296c4b5293b22481d5704747970650d0000000f7369676e6572732d726f7461746564";
      
const json = cvToJSON(hexToCV(hex));

console.log('type:', json.value['type'].value);
console.log('epoch:', json.value['epoch'].value);
console.log('signers-hash:', json.value['signers-hash'].value);
console.log('signers:', {
    signers: json.value['signers'].value.signers.value.map((s: any) => ({ signer: s.value.signer.value, weight: s.value.weight.value })),
    threshold: json.value['signers'].value.threshold.value,
    nonce: json.value['signers'].value.nonce.value,
});

```

output:

```
type: signers-rotated
epoch: 2
signers-hash: 0x7146e0383fc88d294cdfde2685895a88f56d34c46f3e2296c4b5293b22481d57
signers: {
  signers: [
    {
      signer: '0x0277ad46cf1f82953116604c137c41d11fc095694d046417820a3d77253363b904',
      weight: '1'
    },
    {
      signer: '0x031244d4c729f83c9e7898a85283e7460783a711746ba2ff24767443109ae1e64f',
      weight: '1'
    },
    {
      signer: '0x03a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d7',
      weight: '1'
    },
    {
      signer: '0x0319ea093014a1cc7f4aa0219506c20bc1de1480ea157b9b28a088d5f8a70e63cb',
      weight: '1'
    }
  ],
  threshold: '3',
  nonce: '0x32'
}
```