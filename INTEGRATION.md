Based on
the [Axelar Amplifier Gateway Integration doc](https://github.com/axelarnetwork/axelar-gmp-sdk-solidity/blob/main/contracts/gateway/INTEGRATION.md#limits).
We strive to achieve the Recommended requirements.

## Limits

Because of Clarity & Stacks design, all data types must have fixed sizes. Because of this, the following limitations
exists for the Stacks Contracts,
which are also taken into account in the Amplifier Ampd & CosmWasm Contracts as well as in the Relayer.

### Gateway

| Limit                                                         | Value                        |
|---------------------------------------------------------------|------------------------------|
| Cross-chain Message Size (i.e. `payload`)                     | 64 KB                        |
| Chain Name Length (i.e. `destination-chain` & `source-chain`) | 19 ASCII chars               |
| Signer Set Size                                               | 100 signers max              |
| Signature Verification                                        | 100 signatures max           |
| Message Approval Batching                                     | 10 messages max              |
| Storage Limit for Messages                                    | Practically unlimited (2^64) |
| Event Retention                                               | Configurable (in Hiro API)   |

| Stacks specific limits                                      | Value           |
|-------------------------------------------------------------|-----------------|
| Other chain addresses (i.e. `destination-contract-address`) | 128 ASCII chars |              
| Message id (i.e. `message-id`)                              | 128 ASCII chars |

### ITS

| Stacks specific limits                                                                 | Value              |
|----------------------------------------------------------------------------------------|--------------------|
| Other chain addresses (i.e. `source-address` `destination-address`, `trusted-address`) | 128 buff           |
| Token name & symbol                                                                    | 32 ASCII chars max |
| Minter                                                                                 | 128 buff           |
| Interchain Transfer with Payload & Token Manager Params Length                         | 62 KB              |
