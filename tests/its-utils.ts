import {
  BooleanCV,
  BufferCV,
  Cl,
  ContractPrincipalCV,
  cvToJSON,
  ListCV,
  PrincipalCV,
  ResponseOkCV,
  StringAsciiCV,
  TupleCV,
  UIntCV,
} from "@stacks/transactions";

import createKeccakHash from "keccak";
import { expect } from "vitest";
import {
  BURN_ADDRESS,
  ITS_HUB_ROUTING_IDENTIFIER,
  MessageType,
  MetadataVersion,
  TokenType,
  TRUSTED_ADDRESS,
  TRUSTED_CHAIN,
} from "./constants";
import { Signers } from "./types";
import {
  deployGateway,
  gasImplContract,
  gatewayImplCV,
  makeProofCV,
  signersToCv
} from "./util";
import { getNITMockCv, getTokenManagerMockCv } from "./verification-util";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get("wallet_1")!;
export const itsImpl = Cl.address(`${deployer}.interchain-token-service-impl`);

export function setupTokenManager({
  tokenType = TokenType.LOCK_UNLOCK,
  operator = address1,
  sender = deployer,
  contract = "token-manager",
}: {
  contract?: string;
  tokenType?: TokenType;
  operator?: string | null;
  sender?: string;
}) {
  return simnet.callPublicFn(
    contract,
    "setup",
    [
      Cl.contractPrincipal(deployer, "sample-sip-010"),
      Cl.uint(tokenType),
      operator ? Cl.some(Cl.standardPrincipal(operator)) : Cl.none(),
    ],
    sender,
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
  impl = itsImpl,
  verificationParams = getTokenManagerMockCv(),
}: {
  impl?: PrincipalCV;
  salt: Buffer | Uint8Array;
  destinationChain?: string;
  tokenType?: 0 | 2;
  tokenAddress?: ContractPrincipalCV;
  tokenManagerAddress?: ContractPrincipalCV;
  verificationParams?: TupleCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "deploy-token-manager",
    [
      gatewayImplCV,
      gasImplContract,
      impl,
      Cl.buffer(salt),
      Cl.stringAscii(destinationChain),
      Cl.uint(tokenType),
      Cl.buffer(
        Cl.serialize(
          Cl.tuple({
            operator: Cl.some(Cl.address(address1)),
            "token-address": tokenAddress,
          }),
        ),
      ),
      tokenManagerAddress,
      verificationParams,
    ],
    address1,
  );
}

export function getTokenId(
  salt: Uint8Array | Buffer,
  deployer: string = address1,
) {
  return simnet.callReadOnlyFn(
    "interchain-token-service-impl",
    "interchain-token-id-raw",
    [Cl.standardPrincipal(deployer), Cl.buffer(salt)],
    address1,
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
    "payload-hash": Cl.buffer(keccak256(Cl.serialize(payload))),
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
    "payload-hash": Cl.buffer(keccak256(Cl.serialize(payload))),
  };
}
export function getDataHashFromMessages({ messages }: { messages: ListCV }) {
  const { result } = simnet.callReadOnlyFn(
    "gateway-impl",
    "data-hash-from-messages",
    [messages],
    address1,
  );
  return cvToJSON(result).value.replace("0x", "");
}
export function getSignersHash({ proofSigners }: { proofSigners: Signers }) {
  const { result } = simnet.callReadOnlyFn(
    "gateway-impl",
    "get-signers-hash",
    [signersToCv(proofSigners)],
    address1,
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
    "gateway-impl",
    "message-hash-to-sign",
    [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)],
    address1,
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
      "gateway-impl",
      "message-hash-to-sign",
      [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)],
      address1,
    );
    return cvToJSON(result).value;
  })();

  const proof = makeProofCV(proofSigners, messageHashToSign);
  const { result: approveResult } = simnet.callPublicFn(
    "gateway",
    "approve-messages",
    [
      gatewayImplCV,
      Cl.buffer(Cl.serialize(messages)),
      Cl.buffer(Cl.serialize(proof)),
    ],
    address1,
  );

  return expect(approveResult).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));
}

export function setPaused({
  paused,
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
  paused: boolean;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "set-paused",
    [impl, Cl.bool(paused)],
    deployer,
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
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
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
      gatewayImplCV,
      gasImplContract,
      impl,
      Cl.buffer(salt),
      Cl.stringAscii(destinationChain),
      Cl.stringAscii(name),
      Cl.stringAscii(symbol),
      Cl.uint(decimals),
      Cl.buffer(minter),
      Cl.uint(gasValue),
    ],
    address1,
  );
}

export function executeDeployInterchainToken({
  messageId,
  payload,
  sourceAddress,
  sourceChain,
  tokenAddress,
  impl = itsImpl,
  verificationParams = getNITMockCv(),
}: {
  impl?: PrincipalCV;
  messageId: string;
  sourceChain: string;
  sourceAddress: string;
  tokenAddress: `${string}.${string}`;
  payload: Buffer | Uint8Array;
  verificationParams?: TupleCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "execute-deploy-interchain-token",
    [
      gatewayImplCV,
      gasImplContract,
      impl,
      Cl.stringAscii(sourceChain),
      Cl.stringAscii(messageId),
      Cl.stringAscii(sourceAddress),
      Cl.contractPrincipal(...(tokenAddress.split(".") as [string, string])),
      Cl.buffer(payload),
      verificationParams,
    ],
    address1,
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
  sourceChain = "ethereum",
}: {
  tokenId: BufferCV;
  sourceChain?: string;
}) {
  return Cl.tuple({
    // (define-constant MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN u1)
    type: Cl.uint(MessageType.DEPLOY_INTERCHAIN_TOKEN),
    "source-chain": Cl.stringAscii(sourceChain),
    "token-id": tokenId,
    name: Cl.stringAscii("native-interchain-token"),
    symbol: Cl.stringAscii("NIT"),
    decimals: Cl.uint(6),
    "minter-bytes": Cl.bufferFromHex(""),
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
          "interchain-token-service",
        ),
        messageId: Cl.stringAscii(
          "approved-interchain-token-deployment-message",
        ),
        payload,
        sourceAddress: Cl.stringAscii(TRUSTED_ADDRESS),
        sourceChain: Cl.stringAscii(TRUSTED_CHAIN),
      }),
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
  token = Cl.contractPrincipal(address1, "nit"),
  supply = 0,
  minter,
  impl = itsImpl,
  verificationParams = getNITMockCv(),
}: {
  impl?: PrincipalCV;
  salt: Uint8Array | Buffer;
  token?: ContractPrincipalCV;
  supply?: number;
  minter?: PrincipalCV;
  verificationParams?: TupleCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "deploy-interchain-token",
    [
      gatewayImplCV,
      gasImplContract,
      impl,
      Cl.buffer(salt),
      token,
      Cl.uint(supply),
      minter ? Cl.some(minter) : Cl.none(),
      verificationParams,
    ],
    address1,
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
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
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
      gatewayImplCV,
      gasImplContract,
      impl,
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
    caller,
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
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
  messageId: string;
  sourceChain: string;
  sourceAddress: string;
  tokenManager: ContractPrincipalCV;
  token: ContractPrincipalCV;
  payload: BufferCV;
  destinationContract?: ContractPrincipalCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "execute-receive-interchain-token",
    [
      gatewayImplCV,
      impl,
      Cl.stringAscii(sourceChain),
      Cl.stringAscii(messageId),
      Cl.stringAscii(sourceAddress),
      tokenManager,
      token,
      payload,
      destinationContract ? Cl.some(destinationContract) : Cl.none(),
    ],
    address1,
  );
}

export function buildIncomingInterchainTransferPayload({
  tokenId,
  recipient,
  sender,
  amount,
  data,
  sourceChain = "ethereum",
}: {
  tokenId: BufferCV;
  sender: string;
  recipient: string;
  amount: number;
  data: BufferCV;
  sourceChain?: string;
}) {
  return Cl.tuple({
    // (define-constant MESSAGE-TYPE-DEPLOY-INTERCHAIN-TOKEN u1)
    type: Cl.uint(MessageType.INTERCHAIN_TRANSFER),
    "source-chain": Cl.stringAscii(sourceChain),
    "token-id": tokenId,
    "source-address": Cl.buffer(Cl.serialize(Cl.address(sender))),
    "destination-address": Cl.buffer(Cl.serialize(Cl.address(recipient))),
    amount: Cl.uint(amount),
    data,
  });
}

export function approveReceiveInterchainTransfer({
  proofSigners,
  payload,
  messageId = "approved-interchain-transfer-message",
}: {
  proofSigners: Signers;
  payload: TupleCV;
  messageId?: string;
}) {
  const messages = Cl.list([
    Cl.tuple(
      buildIncomingGMPMessage({
        contractAddress: Cl.contractPrincipal(
          deployer,
          "interchain-token-service",
        ),
        messageId: Cl.stringAscii(messageId),
        payload,
        sourceAddress: Cl.stringAscii(TRUSTED_ADDRESS),
        sourceChain: Cl.stringAscii(TRUSTED_CHAIN),
      }),
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

export function getSip010Balance({
  address,
  contractAddress,
}: {
  address: string;
  contractAddress: string;
}) {
  const result = simnet.callReadOnlyFn(
    contractAddress,
    "get-balance",
    [Cl.address(address)],
    address1,
  ).result as ResponseOkCV<UIntCV>;
  return result.value.value;
}

export function setupNIT({
  tokenId,
  minter,
  operator,
  name = "Nitter",
  symbol = "NIT",
  contract = "native-interchain-token",
  sender = deployer,
}: {
  tokenId: BufferCV;
  minter?: string;
  operator?: string;
  name?: string;
  symbol?: string;
  contract?: string;
  sender?: string;
}) {
  return simnet.callPublicFn(
    contract,
    "setup",
    [
      // (token-id_ (buff 32))
      tokenId,
      // (token-type_ uint)
      Cl.uint(TokenType.NATIVE_INTERCHAIN_TOKEN),
      // (operator-address (optional principal))
      operator ? Cl.some(Cl.address(operator)) : Cl.none(),
      // (name_ (string-ascii 32))
      Cl.stringAscii(name),
      // (symbol_ (string-ascii 32))
      Cl.stringAscii(symbol),
      // (decimals_ uint)
      Cl.uint(6),
      // (token-uri_ (optional (string-utf8 256)))
      Cl.none(),
      minter ? Cl.some(Cl.address(minter)) : Cl.none(),
    ],
    sender,
  );
}

export function approveDeployNativeInterchainToken({
  tokenId,
  proofSigners,
  minter = BURN_ADDRESS,
  operator = BURN_ADDRESS,
  supply = 0,
}: {
  tokenId: BufferCV;
  proofSigners: Signers;
  minter?: string;
  operator?: string;
  supply?: number;
}) {
  const payload = Cl.tuple({
    decimals: Cl.uint(6),
    minter: Cl.address(minter),
    name: Cl.stringAscii("Nitter"),
    operator: Cl.address(operator),
    supply: Cl.uint(supply),
    symbol: Cl.stringAscii("NIT"),
    "token-address": Cl.address(`${deployer}.nit`),
    "token-id": tokenId,
    "token-type": Cl.uint(TokenType.NATIVE_INTERCHAIN_TOKEN),
    type: Cl.uint(MessageType.DEPLOY_INTERCHAIN_TOKEN),
  });
  const messages = Cl.list([
    Cl.tuple(
      buildIncomingGMPMessage({
        contractAddress: Cl.contractPrincipal(
          deployer,
          "interchain-token-service",
        ),
        messageId: Cl.stringAscii(
          "approved-native-interchain-token-deployment-message",
        ),
        payload,
        sourceAddress: Cl.stringAscii("interchain-token-service"),
        sourceChain: Cl.stringAscii("stacks"),
      }),
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

export function mintNIT({
  amount,
  minter,
  recipient,
  NITAddress = "native-interchain-token",
}: {
  minter: string;
  amount: number;
  NITAddress?: string;
  // mints to minter if not provided.
  recipient?: string;
}) {
  return simnet.callPublicFn(
    NITAddress,
    "mint",
    [Cl.address(recipient ?? minter), Cl.uint(amount)],
    minter,
  );
}

export function burnNIT({
  amount,
  minter,
  recipient,
  NITAddress = "native-interchain-token",
}: {
  minter: string;
  amount: number;
  NITAddress?: string;
  // mints to minter if not provided.
  recipient?: string;
}) {
  return simnet.callPublicFn(
    NITAddress,
    "burn",
    [Cl.address(recipient ?? minter), Cl.uint(amount)],
    minter,
  );
}

export function keccak256(data: Uint8Array | Buffer) {
  return createKeccakHash("keccak256").update(Buffer.from(data)).digest();
}

export function callContractWithInterchainToken({
  amount,
  destinationAddress,
  destinationChain,
  gasValue,
  tokenAddress,
  tokenId,
  tokenManagerAddress,
  metadata,
  caller,
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
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
    "call-contract-with-interchain-token",
    [
      gatewayImplCV,
      gasImplContract,
      impl,
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
    caller,
  );
}

export function setupService(proofSigners: Signers, customITSImpl?: string) {
  expect(
    simnet.callPublicFn(
      "interchain-token-service",
      "setup",
      [
        Cl.stringAscii("interchain-token-service"),
        Cl.contractPrincipal(deployer, "gas-service"),
        Cl.standardPrincipal(deployer),
        Cl.list([
          Cl.tuple({
            "chain-name": Cl.stringAscii(TRUSTED_CHAIN),
            address: Cl.stringAscii(TRUSTED_ADDRESS),
          }),
          Cl.tuple({
            "chain-name": Cl.stringAscii("ethereum"),
            address: Cl.stringAscii(ITS_HUB_ROUTING_IDENTIFIER),
          }),
          Cl.tuple({
            "chain-name": Cl.stringAscii("avalanche"),
            address: Cl.stringAscii(ITS_HUB_ROUTING_IDENTIFIER),
          }),
        ]),
        Cl.stringAscii(TRUSTED_CHAIN),
        customITSImpl ? Cl.some(Cl.address(customITSImpl)) : Cl.none(),
      ],
      deployer,
    ).result,
  ).toBeOk(Cl.bool(true));
  deployGateway(proofSigners);
}

export function setFlowLimit({
  tokenId,
  tokenManagerAddress,
  limit,
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
  tokenId: BufferCV;
  tokenManagerAddress: ContractPrincipalCV;
  limit: UIntCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "set-flow-limit",
    [impl, tokenId, tokenManagerAddress, limit],
    deployer,
  );
}

export function giveToken({
  amount,
  contractName,
  receiver,
  sender,
  tokenAddress,
}: {
  amount: number;
  sender: string;
  receiver: string;
  contractName: string;
  tokenAddress: string;
}) {
  return simnet.callPublicFn(
    contractName,
    "give-token",
    [Cl.address(tokenAddress), Cl.address(receiver), Cl.uint(amount)],
    sender,
  );
}
export function takeToken({
  amount,
  contractName,
  from,
  sender,
  tokenAddress,
}: {
  amount: number;
  sender: string;
  from: string;
  contractName: string;
  tokenAddress: string;
}) {
  return simnet.callPublicFn(
    contractName,
    "take-token",
    [Cl.address(tokenAddress), Cl.address(from), Cl.uint(amount)],
    sender,
  );
}

export function getTokenFlowIn(contractName: string) {
  return simnet.callReadOnlyFn(
    contractName,
    "get-flow-in-amount",
    [],
    address1,
  );
}
export function getTokenFlowOut(contractName: string) {
  return simnet.callReadOnlyFn(
    contractName,
    "get-flow-out-amount",
    [],
    address1,
  );
}

export function setTokenFlowLimit(
  contractName: string,
  limit: number,
  sender = address1,
) {
  return simnet.callPublicFn(
    contractName,
    "set-flow-limit",
    [Cl.uint(limit)],
    sender,
  );
}

export function nextEpoch() {
  simnet.mineEmptyBlocks(36);
}

export function getFlowLimit(contractName: string) {
  return simnet.callReadOnlyFn(contractName, "get-flow-limit", [], address1);
}

export function addFlowLimiter({
  operator,
  limiterAddress,
  contractName,
}: {
  limiterAddress: string;
  operator: string;
  contractName: string;
}) {
  return simnet.callPublicFn(
    contractName,
    "add-flow-limiter",
    [Cl.address(limiterAddress)],
    operator,
  );
}

export function removeFlowLimiter({
  operator,
  limiterAddress,
  contractName,
}: {
  operator: string;
  limiterAddress: string;
  contractName: string;
}) {
  return simnet.callPublicFn(
    contractName,
    "remove-flow-limiter",
    [Cl.address(limiterAddress)],
    operator,
  );
}

export function isFlowLimiter({
  limiterAddress,
  contractName,
}: {
  limiterAddress: string;

  contractName: string;
}) {
  return simnet.callReadOnlyFn(
    contractName,
    "is-flow-limiter",
    [Cl.address(limiterAddress)],
    address1,
  );
}

export function isOperator({
  contractName,
  operator,
}: {
  operator: string;
  contractName: string;
}) {
  return simnet.callReadOnlyFn(
    contractName,
    "is-operator",
    [Cl.address(operator)],
    address1,
  );
}

export function transferTokenOperatorShip({
  contractName,
  operator,
  newOperator,
}: {
  contractName: string;
  operator: string;
  newOperator: string;
}) {
  return simnet.callPublicFn(
    contractName,
    "transfer-operatorship",
    [Cl.address(newOperator)],
    operator,
  );
}
export function transferITSOperatorShip({
  operator,
  newOperator,
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
  operator: string;
  newOperator: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "transfer-operatorship",
    [impl, Cl.address(newOperator)],
    operator,
  );
}

export function transferITSOwnership({
  owner,
  newOwner,
  impl = itsImpl,
}: {
  impl?: PrincipalCV;
  owner: string;
  newOwner: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-service",
    "transfer-ownership",
    [impl, Cl.address(newOwner)],
    owner,
  );
}

export function transferSip010({
  amount,
  sender,
  recipient,
  contractAddress,
}: {
  amount: number;
  sender: string;
  recipient: string;
  contractAddress: string;
}) {
  return simnet.callPublicFn(
    contractAddress,
    "transfer",
    [Cl.uint(amount), Cl.address(sender), Cl.address(recipient), Cl.none()],
    sender,
  );
}

export function getHelloWorldValue() {
  return simnet.callReadOnlyFn("hello-world", "get-value", [], address1)
    .result as TupleCV<{
    "source-chain": StringAsciiCV;
    "message-id": StringAsciiCV;
    "source-address": StringAsciiCV;
    "source-address-its": BufferCV;
    payload: BufferCV;
  }>;
}

export function getCommandId({
  sourceChain,
  messageId,
}: {
  sourceChain: string;
  messageId: string;
}) {
  return keccak256(Cl.serialize(Cl.stringAscii(`${sourceChain}_${messageId}`)));
}

export function isMinter({
  address,
  contract = "native-interchain-token",
}: {
  address: string;
  contract?: string;
}) {
  return simnet.callReadOnlyFn(
    contract,
    "is-minter",
    [Cl.address(address)],
    address1,
  ).result as ResponseOkCV<BooleanCV>;
}

export function transferMinterShip({
  newMinter,
  sender,
  contract = "native-interchain-token",
}: {
  newMinter: string;
  sender: string;
  contract?: string;
}) {
  return simnet.callPublicFn(
    contract,
    "transfer-mintership",
    [Cl.address(newMinter)],
    sender,
  );
}
