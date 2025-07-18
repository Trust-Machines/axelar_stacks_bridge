# Gateway 

##  Gateway proxy interface

```clarity
(define-public (call-contract
    (gateway-impl <gateway-trait>)
    (destination-chain (string-ascii 20))
    (destination-contract-address (string-ascii 128))
    (payload (buff 10240))
)
```

```clarity
(define-public (approve-messages
    (gateway-impl <gateway-trait>)
    (messages (buff 4096)) ;; Serialized buff data from Messages type
    (proof (buff 16384)) ;; Serialized buff data from Proof type
)
```

```clarity
(define-public (validate-message
    (gateway-impl <gateway-trait>)
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (payload-hash (buff 32))
)
```

```clarity
(define-public (rotate-signers
    (gateway-impl <gateway-trait>)
    (new-signers (buff 8192)) ;; Serialized buff data from Signers type
    (proof (buff 16384)) ;; Serialized buff data from Proof type
)
```

##  Gateway implementation interface

```clarity
(define-read-only (is-message-approved
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
    (source-address (string-ascii 128))
    (contract-address principal)
    (payload-hash (buff 32))
)
```

```clarity
(define-read-only (is-message-executed
    (source-chain (string-ascii 20))
    (message-id (string-ascii 128))
)
```


## Types

### Messages

```clarity
    (list 10 {
        source-chain: (string-ascii 20),
        message-id: (string-ascii 128),
        source-address: (string-ascii 128),
        contract-address: principal,
        payload-hash: (buff 32)
    })
```

Serialization example:

```js
import {
  bufferCV,
  stringAsciiCV,
  listCV,
  serializeCV,
  tupleCV,
  bufferFromHex,
} from "@stacks/transactions";

const messages = bufferCV(
  serializeCV(
    listCV([
      tupleCV({
        "source-chain": stringAsciiCV("ethereum"),
        "message-id": stringAsciiCV(
          "210d370a7aa448c50d2efa7b1df884da31c9f43aa8e9763df087bb5c592058c5-0"
        ),
        "source-address": bufferFromHex(
          "000Ec41d91A35048FbA4F00522Be80DF0E39e785"
        ),
        "contract-address": bufferFromHex(
          "000F9B4FF55aFcC3C4f9f325EE890c0C806E8FCC"
        ),
        "payload-hash": bufferFromHex(
          "0ceb6cf5466ce364a10d9e045726eb10f01667b8c0a1293ae4ae43baee439833"
        ),
      }),
      tupleCV({
        "source-chain": stringAsciiCV("ethereum"),
        "message-id": stringAsciiCV(
          "fe0d2393e76ea487217b1606aff64535f8526a00e007704f8391fa41c78fb451-0"
        ),
        "source-address": bufferFromHex(
          "000E91D671C29c2DBBc81D16adA4a8bDd6fE518F"
        ),
        "contract-address": bufferFromHex(
          "000D56AA59a39557B62584CEEaF00a55d426E3a3"
        ),
        "payload-hash": bufferFromHex(
          "dab0a0dbe44a3789aab44865f310d59df48c068855d112686bd6359d737aa422"
        ),
      }),
    ])
  )
);
```

### Signers

```clarity
{
    signers: (list 100 {signer: (buff 33), weight: uint}),
    threshold: uint,
    nonce: (buff 32)
}
```

Serialization example:

```js
import {
  bufferCV,
  listCV,
  principalCV,
  serializeCV,
  tupleCV,
  uintCV,
  bufferFromHex,
} from "@stacks/transactions";

const signers = bufferCV(
  serializeCV(
    tupleCV({
      signers: listCV([
        tupleCV({
          signer: bufferFromHex(
            "02acd623205fb9f264b0b483a94269a814c0e1a3396308a08b739ee401d474c3ef"
          ),
          weight: uintCV(1),
        }),
        tupleCV({
          signer: bufferFromHex(
            "02e2f437a4231244bc185ce4ba5f9638d039e4337af71d280c3c366159e6d7bedc"
          ),
          weight: uintCV(2),
        }),
        tupleCV({
          signer: bufferFromHex(
            "03a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d7"
          ),
          weight: uintCV(2),
        }),
      ]),
      threshold: uintCV(3),
      nonce: bufferFromHex(
        "11228e4ef3805b921c2a5062537ebcb8bff5635c72f5ec6950c8c37c0cad8669"
      ),
    })
  )
);
```

### Proof

```clarity
{
    signers: {
        signers: (list 100 {signer: (buff 33), weight: uint}),
        threshold: uint,
        nonce: (buff 32)
    },
    signatures: (list 100 (buff 65))
}
```

Serialization example:

```js
import {
  bufferCV,
  listCV,
  principalCV,
  serializeCV,
  tupleCV,
  uintCV,
  bufferFromHex,
} from "@stacks/transactions";

const proof = bufferCV(
  serializeCV(
    tupleCV({
      signers: tupleCV({
        signers: listCV([
          tupleCV({
            signer: bufferFromHex(
              "02acd623205fb9f264b0b483a94269a814c0e1a3396308a08b739ee401d474c3ef"
            ),
            weight: uintCV(1),
          }),
          tupleCV({
            signer: bufferFromHex(
              "02e2f437a4231244bc185ce4ba5f9638d039e4337af71d280c3c366159e6d7bedc"
            ),
            weight: uintCV(2),
          }),
          tupleCV({
            signer: bufferFromHex(
              "03a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d7"
            ),
            weight: uintCV(2),
          }),
        ]),
        threshold: uintCV(3),
        nonce: bufferFromHex(
          "11228e4ef3805b921c2a5062537ebcb8bff5635c72f5ec6950c8c37c0cad8669"
        ),
      }),
      signatures: listCV([
        bufferFromHex(
          "afb485bfd1a3e087d9bd9053640e915d009a11056cb7a7330285dab72e27b45c9796a66e2b149a068f1222fcc4cce4572dccae6ae86f3e0281bda2e404030f5a"
        ),
        bufferFromHex(
          "c2e42eb433d56996de35c20fdba1a07fcabaa0a3a0d66211df12dcd2bfae3280fa126906a6855657e73111b16b706151960c7b1bab3cc3318d9b95cdec564a41"
        ),
      ]),
    })
  )
);
```

## Events

### contract-call

```clarity
{
    type: "contract-call",
    sender: principal,
    destination-chain: (string-ascii 20),
    destination-contract-address: (string-ascii 128),
    payload-hash: (buff 32),
    payload: (buff 10240)
}
```

With the following hex value:

`0x0c000000061164657374696e6174696f6e2d636861696e0d0000000b44657374696e6174696f6e1c64657374696e6174696f6e2d636f6e74726163742d616464726573730d000000083078313233616263077061796c6f61640200000029535431534a3344544535444e375835345944483544363452334243423641324147325a5138595044350c7061796c6f61642d6861736802000000209ed02951dbf029855b46b102cc960362732569e83d00a49a7575d7aed229890e0673656e646572051a99e2ec69ac5b6e67b4e26edd0e2c1c1a6b9bbd2304747970650d0000000d636f6e74726163742d63616c6c`

The deserialization function [contractCallEventToObj](./tests/util.ts#L148) outputs following:

```
{
  type: 'contract-call',
  sender: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
  destinationChain: 'Destination',
  destinationContractAddress: '0x123abc',
  payload: 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5',
  payloadHash: '0x9ed02951dbf029855b46b102cc960362732569e83d00a49a7575d7aed229890e'
}
```

### message-approved

```clarity
{
    type: "message-approved",
    command-id: (buff 32),
    source-chain: (string-ascii 20),
    message-id: (string-ascii 128),
    source-address: (string-ascii 128),
    contract-address: principal,
    payload-hash: (buff 32)
}
```

With the following hex value:

`0x0c000000070a636f6d6d616e642d69640200000020908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae10636f6e74726163742d61646472657373051a99e2ec69ac5b6e67b4e26edd0e2c1c1a6b9bbd230a6d6573736167652d69640d00000001310c7061796c6f61642d686173680200000020373360faa7d5fc254d927e6aafe6127ec920f30efe61612b7ec6db33e72fb9500e736f757263652d616464726573730d0000000c6164647265737330783132330c736f757263652d636861696e0d00000006536f7572636504747970650d000000106d6573736167652d617070726f766564`

The deserialization function [messageApprovedEventToObj](./tests/util.ts#L161) outputs following:

```
{
  type: 'message-approved',
  commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
  sourceChain: 'Source',
  messageId: '1',
  sourceAddress: 'address0x123',
  contractAddress: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
  payloadHash: '0x373360faa7d5fc254d927e6aafe6127ec920f30efe61612b7ec6db33e72fb950'
}
```

### message-executed

```clarity
{
    type: "message-executed",
    command-id: (buff 32),
    source-chain: (string-ascii 20),
    message-id: (string-ascii 128)
}
```

With the following hex value:

`0x0c000000040a636f6d6d616e642d69640200000020908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae0a6d6573736167652d69640d00000001310c736f757263652d636861696e0d00000006536f7572636504747970650d000000106d6573736167652d6578656375746564`

The deserialization function [messageExecutedEventToObj](./tests/util.ts#L175) outputs following:

```
{
  type: 'message-executed',
  commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
  sourceChain: 'Source',
  messageId: '1'
}
```

### signers-rotated

```clarity
{
    type: "signers-rotated",
    epoch: uint,
    signers-hash: (buff 32),
    signers: {
      signers: (list 100 {signer: (buff 33), weight: uint}),
      threshold: uint,
      nonce: (buff 32)
    }
}
```

With the following hex value:

`0x0c000000040565706f63680100000000000000000000000000000002077369676e6572730c00000003056e6f6e6365020000000132077369676e6572730b000000040c00000002067369676e65720200000021024f59c18b21283c9515727e9a20d330d02fbb1258ed5942971f9233a3af4883650677656967687401000000000000000000000000000000010c00000002067369676e657202000000210252e2248a7df966ad5ce768b12dd1edfe15dd43b22d4dfd71109dfdf0fef8f99b0677656967687401000000000000000000000000000000010c00000002067369676e65720200000021026b27c7ad0a3d839014ff751d41939bee79ea3ffa58c13ea4556c2b45971315500677656967687401000000000000000000000000000000010c00000002067369676e6572020000002102703d593d53307cbdfce1a84a267cd89f89e1e935e4fabed8bf076d7500068012067765696768740100000000000000000000000000000001097468726573686f6c6401000000000000000000000000000000030c7369676e6572732d6861736802000000203f89f80b758e2c80e86ec29e0cec2007286d0269cc85007a34e1dcf404197f5304747970650d0000000f7369676e6572732d726f7461746564`

The deserialization function [signersRotatedEventToObj](./tests/util.ts#L186) outputs following:

```
{
  "type": "signers-rotated",
  "epoch": 2,
  "signersHash": "0x3f89f80b758e2c80e86ec29e0cec2007286d0269cc85007a34e1dcf404197f53",
  "signers": {
    "signers": [
      {
        "signer": "024f59c18b21283c9515727e9a20d330d02fbb1258ed5942971f9233a3af488365",
        "weight": 1
      },
      {
        "signer": "0252e2248a7df966ad5ce768b12dd1edfe15dd43b22d4dfd71109dfdf0fef8f99b",
        "weight": 1
      },
      {
        "signer": "026b27c7ad0a3d839014ff751d41939bee79ea3ffa58c13ea4556c2b4597131550",
        "weight": 1
      },
      {
        "signer": "02703d593d53307cbdfce1a84a267cd89f89e1e935e4fabed8bf076d7500068012",
        "weight": 1
      }
    ],
    "threshold": 3,
    "nonce": "2"
  }
}
```
