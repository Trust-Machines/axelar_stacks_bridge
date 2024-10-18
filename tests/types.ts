export type Signers = {
    signers: {
        signer: string,
        weight: number
    }[],
    threshold: number,
    nonce: string
}

type GatewayEvent = { type: 'contract-call' | 'message-approved' | 'message-executed' | 'signers-rotated' }

export interface ContractCallEvent extends GatewayEvent { sender: string, destinationChain: string, destinationContractAddress: string, payload: string, payloadHash: string }

export interface MessageApprovedEvent extends GatewayEvent { commandId: string, sourceChain: string, messageId: string, sourceAddress: string, contractAddress: string, payloadHash: string }

export interface MessageExecutedEvent extends GatewayEvent { commandId: string, sourceChain: string, messageId: string }

export interface SignersRotatedEvent extends GatewayEvent { epoch: number, signersHash: string, signers: Signers }
