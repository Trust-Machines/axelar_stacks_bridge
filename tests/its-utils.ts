import {
  BufferCV,
  Cl,
  ContractPrincipalCV,
  cvToJSON,
  ListCV,
  PrincipalCV,
  StringAsciiCV,
  TupleCV,
  UIntCV,
} from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get("wallet_1")!;
import createKeccakHash from "keccak";
import { expect } from "vitest";
import { makeProofCV, signersToCv } from "./util";
import { Signers } from "./types";
import {
  TokenType,
  MessageType,
  TRUSTED_ADDRESS,
  MetadataVersion,
  TRUSTED_CHAIN,
} from "./constants";

export function setupTokenManager({
  tokenType = TokenType.LOCK_UNLOCK,
}: {
  tokenType?: TokenType;
}) {
  return simnet.callPublicFn(
    "token-manager",
    "setup",
    [
      Cl.contractPrincipal(deployer, "sample-sip-010"),
      Cl.uint(tokenType),
      Cl.contractPrincipal(deployer, "interchain-token-service"),
      Cl.some(Cl.standardPrincipal(address1)),
    ],
    deployer
  );
}

export function buildVerifyTokenManagerPayload({
  tokenId,
  wrappedPayload,
}: {
  tokenId: BufferCV;
  wrappedPayload?: {
    "source-chain": StringAsciiCV;
    "source-address": StringAsciiCV;
    "message-id": StringAsciiCV;
    payload: BufferCV;
  };
}) {
  return Cl.tuple({
    type: Cl.stringAscii("verify-token-manager"),
    // "token-address": Cl.contractPrincipal(deployer, "sample-sip-010"),
    "token-manager-address": Cl.contractPrincipal(deployer, "token-manager"),
    "token-id": tokenId,
    "token-type": Cl.uint(TokenType.LOCK_UNLOCK),
    operator: Cl.address(address1),
    "wrapped-payload": wrappedPayload
      ? Cl.some(Cl.tuple(wrappedPayload))
      : Cl.none(),
  });
}

export function deployTokenManager({
  salt,
  destinationChain = "",
  tokenType = TokenType.LOCK_UNLOCK,
  tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010"),
  tokenManagerAddress = Cl.contractPrincipal(deployer, "token-manager"),
  gas = 0,
}: {
  salt: Buffer | Uint8Array;
  destinationChain?: string;
  tokenType?: 0 | 2;
  tokenAddress?: ContractPrincipalCV;
  tokenManagerAddress?: ContractPrincipalCV;
  gas?: number;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "deploy-token-manager",
    [
      Cl.buffer(salt),
      Cl.stringAscii(destinationChain),
      Cl.uint(tokenType),
      Cl.uint(gas),
      Cl.buffer(
        Cl.serialize(
          Cl.tuple({
            operator: Cl.address(address1),
            "token-address": tokenAddress,
          })
        )
      ),
      tokenManagerAddress,
    ],
    address1
  );
}

export function enableTokenManager({
  tokenId,
  proofSigners,
  wrappedPayload,
  messageId = "0x00",
}: {
  tokenId: BufferCV;
  proofSigners: Signers;
  wrappedPayload?: {
    "source-chain": StringAsciiCV;
    "source-address": StringAsciiCV;
    "message-id": StringAsciiCV;
    payload: BufferCV;
  };
  messageId?: string;
}) {
  const payload = buildVerifyTokenManagerPayload({ tokenId, wrappedPayload });

  const messages = Cl.list([
    Cl.tuple(
      buildIncomingGMPMessage({
        contractAddress: Cl.contractPrincipal(
          deployer,
          "interchain-token-service"
        ),
        messageId: Cl.stringAscii(messageId),
        payload,
        sourceAddress: Cl.stringAscii("interchain-token-service"),
        sourceChain: Cl.stringAscii("stacks"),
      })
    ),
  ]);
  signAndApproveMessages({
    messages,
    proofSigners,
  });

  if (wrappedPayload) {
    const messages = Cl.list([
      Cl.tuple(
        buildIncomingGMPMessage({
          contractAddress: Cl.contractPrincipal(
            deployer,
            "interchain-token-service"
          ),
          messageId: wrappedPayload["message-id"],
          payload: Cl.deserialize(wrappedPayload.payload.buffer),
          sourceAddress: wrappedPayload["source-address"],
          sourceChain: wrappedPayload["source-chain"],
        })
      ),
    ]);
    signAndApproveMessages({
      messages,
      proofSigners,
    });
  }

  const enableTokenTx = simnet.callPublicFn(
    "interchain-token-service",
    "process-deploy-token-manager-from-stacks",
    [
      Cl.stringAscii(messageId),
      Cl.stringAscii("stacks"),
      Cl.stringAscii("interchain-token-service"),
      Cl.buffer(Cl.serialize(payload)),
    ],
    address1
  );
  expect(enableTokenTx.result).toBeOk(Cl.bool(true));
  expect(
    simnet.callReadOnlyFn(
      "gateway",
      "is-message-executed",
      [Cl.stringAscii("stacks"), Cl.stringAscii(messageId)],
      address1
    ).result
  ).toBeOk(Cl.bool(true));
}

export function getTokenId(salt: Uint8Array | Buffer) {
  return simnet.callReadOnlyFn(
    "interchain-token-service",
    "interchain-token-id",
    [Cl.standardPrincipal(address1), Cl.buffer(salt)],
    address1
  );
}

export function buildOutgoingGMPMessage({
  payload,
  destinationChain,
  destinationContractAddress,
  sender,
}: {
  payload: TupleCV;
  destinationChain: string;
  destinationContractAddress: string;
  sender: PrincipalCV;
}) {
  return {
    type: Cl.stringAscii("contract-call"),
    sender,
    "destination-chain": Cl.stringAscii(destinationChain),
    "destination-contract-address": Cl.stringAscii(destinationContractAddress),
    payload: Cl.buffer(Cl.serialize(payload)),
    "payload-hash": Cl.buffer(
      createKeccakHash("keccak256")
        .update(Buffer.from(Cl.serialize(payload)))
        .digest()
    ),
  };
}

export function buildIncomingGMPMessage({
  payload,
  sourceAddress,
  sourceChain,
  contractAddress,
  messageId,
}: {
  sourceChain: StringAsciiCV;
  messageId: StringAsciiCV;
  sourceAddress: StringAsciiCV;
  contractAddress: ContractPrincipalCV;
  payload: TupleCV;
}) {
  return {
    "source-chain": sourceChain,
    "message-id": messageId,
    "source-address": sourceAddress,
    "contract-address": contractAddress,
    "payload-hash": Cl.buffer(
      createKeccakHash("keccak256")
        .update(Buffer.from(Cl.serialize(payload)))
        .digest()
    ),
  };
}
export function getDataHashFromMessages({ messages }: { messages: ListCV }) {
  const { result } = simnet.callReadOnlyFn(
    "gateway",
    "data-hash-from-messages",
    [messages],
    address1
  );
  return cvToJSON(result).value.replace("0x", "");
}
export function getSignersHash({ proofSigners }: { proofSigners: Signers }) {
  const { result } = simnet.callReadOnlyFn(
    "gateway",
    "get-signers-hash",
    [signersToCv(proofSigners)],
    address1
  );
  return cvToJSON(result).value;
}

export const getMessageHashToSign = ({
  signersHash,
  dataHash,
}: {
  signersHash: string;
  dataHash: string;
}) => {
  const { result } = simnet.callReadOnlyFn(
    "gateway",
    "message-hash-to-sign",
    [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)],
    address1
  );
  return cvToJSON(result).value;
};

export function signAndApproveMessages({
  messages,
  proofSigners,
}: {
  messages: ListCV;
  proofSigners: Signers;
}) {
  const dataHash = getDataHashFromMessages({ messages });

  const signersHash = getSignersHash({ proofSigners });
  const messageHashToSign = (() => {
    const { result } = simnet.callReadOnlyFn(
      "gateway",
      "message-hash-to-sign",
      [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)],
      address1
    );
    return cvToJSON(result).value;
  })();

  const proof = makeProofCV(proofSigners, messageHashToSign);
  const { result: approveResult } = simnet.callPublicFn(
    "gateway",
    "approve-messages",
    [Cl.buffer(Cl.serialize(messages)), Cl.buffer(Cl.serialize(proof))],
    address1
  );

  return expect(approveResult).toBeOk(Cl.bool(true));
}

export function setPaused({ paused }: { paused: boolean }) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "set-paused",
    [Cl.bool(paused)],
    deployer
  );
}

export type OutGoingGMPMessage = ReturnType<typeof buildOutgoingGMPMessage>;
export type InComingGMPMessage = ReturnType<typeof buildIncomingGMPMessage>;

export function deployRemoteInterchainToken({
  salt,
  destinationChain,
  name,
  symbol,
  decimals,
  minter,
  gasValue,
}: {
  salt: Buffer | Uint8Array;
  destinationChain: string;
  name: string;
  symbol: string;
  decimals: number;
  minter: Buffer | Uint8Array;
  gasValue: number;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "deploy-remote-interchain-token",
    [
      Cl.buffer(salt),
      Cl.stringAscii(destinationChain),
      Cl.stringAscii(name),
      Cl.stringAscii(symbol),
      Cl.uint(decimals),
      Cl.buffer(minter),
      Cl.uint(gasValue),
    ],
    address1
  );
}

export function executeDeployInterchainToken({
  messageId,
  payload,
  sourceAddress,
  sourceChain,
  tokenAddress,
}: {
  messageId: string;
  sourceChain: string;
  sourceAddress: string;
  tokenAddress: `${string}.${string}`;
  payload: Buffer | Uint8Array;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "execute-deploy-interchain-token",
    [
      Cl.stringAscii(messageId),
      Cl.stringAscii(sourceChain),
      Cl.stringAscii(sourceAddress),
      Cl.contractPrincipal(...(tokenAddress.split(".") as [string, string])),
      Cl.buffer(payload),
    ],
    address1
  );
}
export function buildVerifyInterchainTokenPayload({
  tokenId,
}: {
  tokenId: BufferCV;
}) {
  return Cl.tuple({
    type: Cl.stringAscii("verify-token-manager"),
    "token-address": Cl.contractPrincipal(deployer, "sample-sip-010"),
    "token-manager-address": Cl.contractPrincipal(deployer, "token-manager"),
    "token-id": tokenId,
    "token-type": Cl.uint(TokenType.LOCK_UNLOCK),
    operator: Cl.address(address1),
  });
}

export function buildIncomingDeployInterchainTokenPayload({
  tokenId,
}: {
  tokenId: BufferCV;
}) {
  return Cl.tuple({
    // (define-constant MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN u1)
    type: Cl.uint(MessageType.DEPLOY_INTERCHAIN_TOKEN),
    "source-chain": Cl.stringAscii("ethereum"),
    "token-id": tokenId,
    name: Cl.stringAscii("native-interchain-token"),
    symbol: Cl.stringAscii("ITT"),
    decimals: Cl.uint(18),
    "minter-bytes": Cl.buffer(Buffer.from([0])),
  });
}

export function approveRemoteInterchainToken({
  tokenId,
  proofSigners,
}: {
  tokenId: BufferCV;
  proofSigners: Signers;
}) {
  const payload = buildIncomingDeployInterchainTokenPayload({
    tokenId,
  });
  const messages = Cl.list([
    Cl.tuple(
      buildIncomingGMPMessage({
        contractAddress: Cl.contractPrincipal(
          deployer,
          "interchain-token-service"
        ),
        messageId: Cl.stringAscii(
          "approved-interchain-token-deployment-message"
        ),
        payload,
        sourceAddress: Cl.stringAscii(TRUSTED_ADDRESS),
        sourceChain: Cl.stringAscii(TRUSTED_CHAIN),
      })
    ),
  ]);
  signAndApproveMessages({
    messages,
    proofSigners,
  });

  return {
    payload,
  };
}

export function deployInterchainToken({
  salt,
  token = Cl.contractPrincipal(deployer, "native-interchain-token"),
  supply = 0,
  minter,
}: {
  salt: Uint8Array | Buffer;
  token?: ContractPrincipalCV;
  supply?: number;
  minter?: PrincipalCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "deploy-interchain-token",
    [
      Cl.buffer(salt),
      token,
      Cl.uint(supply),
      minter ? Cl.some(minter) : Cl.none(),
    ],
    address1
  );
}

export function executeDeployTokenManager({
  messageId,
  payload,
  sourceAddress,
  sourceChain,
  token,
  tokenManager,
}: {
  messageId: string;
  sourceChain: string;
  sourceAddress: string;
  payload: {
    "source-chain": StringAsciiCV;
    type: UIntCV;
    "token-id": BufferCV;
    "token-manager-type": UIntCV;
    params: BufferCV;
  };
  token: ContractPrincipalCV;
  tokenManager: ContractPrincipalCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "execute-deploy-token-manager",
    [
      Cl.stringAscii(messageId),
      Cl.stringAscii(sourceChain),
      Cl.stringAscii(sourceAddress),
      Cl.buffer(Cl.serialize(Cl.tuple(payload))),
      token,
      tokenManager,
    ],
    address1
  );
}

export function interchainTransfer({
  amount,
  destinationAddress,
  destinationChain,
  gasValue,
  tokenAddress,
  tokenId,
  tokenManagerAddress,
  metadata,
  caller,
}: {
  tokenManagerAddress: PrincipalCV;
  tokenAddress: PrincipalCV;
  tokenId: BufferCV;
  amount: UIntCV;
  destinationChain: StringAsciiCV;
  destinationAddress: BufferCV;
  gasValue: UIntCV;
  metadata?: {
    version: UIntCV;
    data: BufferCV;
  };
  caller: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "interchain-transfer",
    [
      tokenManagerAddress,
      tokenAddress,
      tokenId,
      destinationChain,
      destinationAddress,
      amount,
      metadata
        ? Cl.tuple(metadata)
        : Cl.tuple({
            version: Cl.uint(MetadataVersion.ContractCall),
            data: Cl.bufferFromHex("0x"),
          }),
      gasValue,
    ],
    caller
  );
}

export function buildFtTransferEvent({
  amount,
  tokenAddress,
  tokenName,
  recipient,
  sender,
}: {
  amount: number;
  tokenName: string;
  tokenAddress: string;
  sender: string;
  recipient: string;
}) {
  return {
    event: "ft_transfer_event",
    data: {
      amount: `${amount}`,
      asset_identifier: `${tokenAddress}::${tokenName}`,
      sender,
      recipient,
    },
  };
}

export function buildSTXTransferEvent({
  amount,
  recipient,
  sender,
  memo = "",
}: {
  amount: number;
  sender: string;
  recipient: string;
  memo?: string;
}) {
  return {
    event: "stx_transfer_event",
    data: {
      amount: `${amount}`,
      memo,
      recipient,
      sender,
    },
  };
}

export function executeReceiveInterchainToken({
  messageId,
  sourceChain,
  sourceAddress,
  tokenManager,
  token,
  payload,
  destinationContract,
}: {
  messageId: string;
  sourceChain: string;
  sourceAddress: string;
  tokenManager: ContractPrincipalCV;
  token: ContractPrincipalCV;
  payload: {
    type: UIntCV;
    "token-id": BufferCV;
    "source-chain": StringAsciiCV;
    "source-address": BufferCV;
    "destination-address": BufferCV;
    amount: UIntCV;
    data: BufferCV;
  };
  destinationContract?: ContractPrincipalCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "execute-receive-interchain-token",
    [
      Cl.stringAscii(messageId),
      Cl.stringAscii(sourceChain),
      Cl.stringAscii(sourceAddress),
      tokenManager,
      token,
      Cl.buffer(Cl.serialize(Cl.tuple(payload))),
      destinationContract ? Cl.some(destinationContract) : Cl.none(),
    ],
    address1
  );
}
