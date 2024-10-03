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
    (messages (buff 4096)) 
    (proof (buff 7168))
)
```

`messages` gets parsed into a [Message](#message) list of max 10 items.

`proof` gets parsed into [Proof](#proof) type


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
    (new-signers (buff 4096))
    (proof (buff 7168))
)
```

## Types

### Message 
<a name="message-type"></a>
```clarity
{
    source-chain: (buff 18),
    message-id: (buff 32),
    source-address: (buff 96),
    contract-address: (buff 96),
    payload-hash: (buff 32)
}
```

### WeightedSigner
```clarity
{
    signer: principal, 
    weight: uint
}
```

### WeightedSigners
```clarity
{ 
    signers: (list 32 {signer: principal, weight: uint}), 
    threshold: uint, 
    nonce: (buff 32) 
}
```

### Proof 
<a name="proof-type"></a>
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

## Events

### contract-call
```clarity
{
    type: "contract-call",
    sender: string,
    destination-chain: (buff 18)
    destination-contract-address: (buff 96),
    payload-hash: (buff 32),
    payload: (buff 10240)
}
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