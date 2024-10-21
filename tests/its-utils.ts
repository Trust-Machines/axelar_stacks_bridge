import {
  BufferCV,
  Cl,
  ContractPrincipalCV,
  cvToJSON,
  ListCV,
  PrincipalCV,
  TupleCV,
} from "@stacks/transactions";

export const TOKEN_TYPE_NATIVE_INTERCHAIN_TOKEN = 0;
export const TOKEN_TYPE_LOCK_UNLOCK = 2;
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get("wallet_1")!;
import createKeccakHash from "keccak";
import { expect } from "vitest";
import { makeProofCV, signersToCv } from "./util";
import { Signers } from "./types";

export function setupTokenManager() {
  return simnet.callPublicFn(
    "token-manager",
    "setup",
    [
      Cl.contractPrincipal(deployer, "sample-sip-010"),
      Cl.uint(2),
      Cl.contractPrincipal(deployer, "interchain-token-service"),
      Cl.some(Cl.standardPrincipal(address1)),
    ],
    deployer
  );
}

export function buildVerifyTokenManagerPayload({
  tokenId,
}: {
  tokenId: BufferCV;
}) {
  return Cl.tuple({
    type: Cl.stringAscii("verify-token-manager"),
    "token-address": Cl.contractPrincipal(deployer, "sample-sip-010"),
    "token-manager-address": Cl.contractPrincipal(deployer, "token-manager"),
    "token-id": tokenId,
    "token-type": Cl.uint(2),
  });
}

export function deployTokenManager({
  salt,
  destinationChain = "",
  tokenType = TOKEN_TYPE_LOCK_UNLOCK,
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
      Cl.buffer(Buffer.from([])),
      Cl.some(tokenAddress),
      Cl.some(tokenManagerAddress),
    ],
    address1
  );
}

export function enableTokenManager({
  tokenId,
  proofSigners,
}: {
  tokenId: BufferCV;
  proofSigners: Signers;
}) {
  const payload = buildVerifyTokenManagerPayload({ tokenId });

  const messages = Cl.list([
    Cl.tuple(
      buildIncomingGMPMessage({
        contractAddress: "interchain-token-service",
        messageId: "0x00",
        payload,
        sourceAddress: "interchain-token-service",
        sourceChain: "stacks",
      })
    ),
  ]);
  signAndApproveMessages({
    messages,
    proofSigners,
  });

  const enableTokenTx = simnet.callPublicFn(
    "interchain-token-service",
    "process-deploy-token-manager-from-stacks",
    [
      Cl.stringAscii("0x00"),
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
      [Cl.stringAscii("stacks"), Cl.stringAscii("0x00")],
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
  sourceChain: string;
  messageId: string;
  sourceAddress: string;
  contractAddress: string;
  payload: TupleCV;
}) {
  return {
    "source-chain": Cl.stringAscii(sourceChain),
    "message-id": Cl.stringAscii(messageId),
    "source-address": Cl.stringAscii(sourceAddress),
    "contract-address": Cl.contractPrincipal(deployer, contractAddress),
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
