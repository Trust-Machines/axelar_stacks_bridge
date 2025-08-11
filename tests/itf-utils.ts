import {
  BufferCV,
  Cl,
  ListCV,
  PrincipalCV,
  ResponseOkCV,
  TupleCV,
  UIntCV,
} from "@stacks/transactions";
import { BURN_ADDRESS } from "./constants";
import { itsImpl } from "./its-utils";
import { gasImplContract, gatewayImplCV } from "./util";
import {
  getNITMockCv,
  getTokenManagerMockCv,
  nitMockParams,
} from "./verification-util";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get("wallet_1")!;

export const itfImpl = Cl.address(`${deployer}.interchain-token-factory-impl`);

export function factoryDeployInterchainToken({
  sender,
  salt,
  tokenAddress = `${address1}.${nitMockParams.name}`,
  initialSupply = 0,
  name = "Nitter",
  symbol = "NIT",
  decimals = 6,
  minterAddress = BURN_ADDRESS,
  impl = itfImpl,
  verificationParams = getNITMockCv(),
}: {
  impl?: PrincipalCV;
  sender: string;
  salt: Buffer | Uint8Array;
  tokenAddress?: string;
  initialSupply?: number;
  name?: string;
  symbol?: string;
  decimals?: number;
  minterAddress?: string;
  gasValue?: number;
  verificationParams?: TupleCV<
    Record<
      string,
      BufferCV | UIntCV | TupleCV<Record<string, UIntCV | ListCV<BufferCV>>>
    >
  >;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "deploy-interchain-token",
    [
      impl,
      gatewayImplCV,
      gasImplContract,
      itsImpl,
      Cl.buffer(salt),
      Cl.address(tokenAddress),
      Cl.uint(initialSupply),
      Cl.stringAscii(name),
      Cl.stringAscii(symbol),
      Cl.uint(decimals),
      Cl.address(minterAddress),
      verificationParams,
    ],
    sender
  );
}

export function getCanonicalInterChainTokenId({
  tokenAddress = `${deployer}.sample-sip-010`,
}: {
  tokenAddress?: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory-impl",
    "get-canonical-interchain-token-id",
    [itsImpl, Cl.address(tokenAddress)],
    address1
  ).result as ResponseOkCV<BufferCV>;
}

export function registerCanonicalInterchainToken({
  sender = address1,
  tokenAddress = `${deployer}.sample-sip-010`,
  tokenManagerAddress = `${deployer}.token-manager`,
  impl = itfImpl,
  verificationParams = getTokenManagerMockCv(),
}: {
  impl?: PrincipalCV;
  sender?: string;
  tokenAddress?: string;
  tokenManagerAddress?: string;
  verificationParams?: TupleCV;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "register-canonical-interchain-token",
    [
      impl,
      gatewayImplCV,
      gasImplContract,
      itsImpl,
      Cl.address(tokenAddress),
      Cl.address(tokenManagerAddress),
      verificationParams,
    ],
    sender
  );
}

export function deployRemoteCanonicalInterchainToken({
  sender = address1,
  tokenAddress = `${deployer}.sample-sip-010`,
  destinationChain = "ethereum",
  gasValue = 100,
  impl = itfImpl,
}: {
  impl?: PrincipalCV;
  sender?: string;
  tokenAddress?: string;
  destinationChain?: string;
  gasValue?: number;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "deploy-remote-canonical-interchain-token",
    [
      impl,
      gatewayImplCV,
      gasImplContract,
      itsImpl,
      Cl.address(tokenAddress),
      Cl.stringAscii(destinationChain),
      Cl.uint(gasValue),
    ],
    sender
  );
}

export function getInterchainTokenId({
  salt,
  sender,
  deployer,
}: {
  salt: BufferCV;
  deployer: PrincipalCV;
  sender: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory-impl",
    "get-interchain-token-id",
    [itsImpl, deployer, salt],
    sender
  ).result as ResponseOkCV<BufferCV>;
}

export function factoryDeployRemoteInterchainToken({
  salt,
  minter = address1,
  destinationChain = "ethereum",
  gasValue = 100,
  tokenAddress,
  tokenManagerAddress,
  sender = address1,
  impl = itfImpl,
}: {
  impl?: PrincipalCV;
  salt: Buffer | Uint8Array;
  minter?: string;
  destinationChain?: string;
  gasValue?: number;
  tokenAddress: string;
  tokenManagerAddress: string;
  sender?: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "deploy-remote-interchain-token",
    [
      impl,
      gatewayImplCV,
      gasImplContract,
      itsImpl,
      Cl.buffer(salt),
      Cl.address(minter),
      Cl.stringAscii(destinationChain),
      Cl.uint(gasValue),
      Cl.address(tokenAddress),
      Cl.address(tokenManagerAddress),
    ],
    sender
  );
}

export function getInterchainTokenSalt({
  deployer,
  salt,
}: {
  deployer: string;
  salt: Buffer | Uint8Array;
}) {
  return simnet.callReadOnlyFn(
    "interchain-token-factory-impl",
    "get-interchain-token-deploy-salt",
    [Cl.address(deployer), Cl.buffer(salt)],
    address1
  ).result as BufferCV;
}

export function factoryDeployRemoteInterchainTokenWithMinter({
  salt,
  minter = address1,
  destinationChain = "ethereum",
  destinationMinter,
  gasValue = 100,
  tokenAddress,
  tokenManagerAddress,
  sender = address1,
  impl = itfImpl,
}: {
  impl?: PrincipalCV;
  salt: Buffer | Uint8Array;
  minter?: string;
  destinationChain?: string;
  destinationMinter?: string;
  gasValue?: number;
  tokenAddress: string;
  tokenManagerAddress: string;
  sender?: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "deploy-remote-interchain-token-with-minter",
    [
      impl,
      gatewayImplCV,
      gasImplContract,
      itsImpl,
      Cl.buffer(salt),
      Cl.address(minter),
      Cl.stringAscii(destinationChain),
      destinationMinter
        ? Cl.some(Cl.bufferFromHex(destinationMinter))
        : Cl.none(),
      Cl.uint(gasValue),
      Cl.address(tokenAddress),
      Cl.address(tokenManagerAddress),
    ],
    sender
  );
}

const NIT = `${address1}.${nitMockParams.name}`;
export function approveDeployRemoteInterchainToken({
  deployer,
  salt,
  destinationChain,
  destinationMinter,
  sender,
  impl = itfImpl,
  token = NIT,
}: {
  impl?: PrincipalCV;
  deployer: string;
  salt: Buffer | Uint8Array;
  destinationChain: string;
  destinationMinter: string;
  token?: string;
  sender: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "approve-deploy-remote-interchain-token",
    [
      impl,
      itsImpl,
      Cl.address(deployer),
      Cl.buffer(salt),
      Cl.stringAscii(destinationChain),
      Cl.bufferFromHex(destinationMinter),
      Cl.address(token),
    ],
    sender
  );
}

export function revokeDeployRemoteInterchainToken({
  deployer,
  salt,
  destinationChain,
  sender,
  impl = itfImpl,
}: {
  impl?: PrincipalCV;
  deployer: string;
  salt: Buffer | Uint8Array;
  destinationChain: string;
  sender: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "revoke-deploy-remote-interchain-token",
    [
      impl,
      itsImpl,
      Cl.address(deployer),
      Cl.buffer(salt),
      Cl.stringAscii(destinationChain),
    ],
    sender
  );
}
