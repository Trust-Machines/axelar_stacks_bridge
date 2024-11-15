import { BufferCV, Cl, PrincipalCV, ResponseOkCV } from "@stacks/transactions";
import { BURN_ADDRESS } from "./constants";
import { itsImpl, keccak256 } from "./its-utils";
import { gatewayImplCV } from "./util";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get("wallet_1")!;

export const itfImpl = Cl.address(`${deployer}.interchain-token-factory-impl`);

export function factoryDeployInterchainToken({
  sender,
  salt,
  tokenAddress = `${deployer}.native-interchain-token`,
  gasValue = 100,
  initialSupply = 0,
  minterAddress = BURN_ADDRESS,
  impl = itfImpl,
}: {
  impl?: PrincipalCV;
  sender: string;
  salt: Buffer | Uint8Array;
  tokenAddress?: string;
  initialSupply?: number;
  minterAddress?: string;
  gasValue?: number;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "deploy-interchain-token",
    [
      impl,
      gatewayImplCV,
      itsImpl,
      Cl.buffer(salt),
      Cl.address(tokenAddress),
      Cl.uint(initialSupply),
      Cl.address(minterAddress),
      Cl.uint(gasValue),
    ],
    sender,
  );
}

export function getCanonicalInterChainTokenId({
  tokenAddress = `${deployer}.sample-sip-010`,
}: {
  tokenAddress?: string;
}) {
  return simnet.callPrivateFn(
    "interchain-token-factory-impl",
    "get-canonical-interchain-token-id",
    [itsImpl, Cl.address(tokenAddress)],
    address1,
  ).result as ResponseOkCV<BufferCV>;
}

export function registerCanonicalInterchainToken({
  sender = address1,
  tokenAddress = `${deployer}.sample-sip-010`,
  tokenManagerAddress = `${deployer}.token-manager`,
  impl = itfImpl,
}: {
  impl?: PrincipalCV;
  sender?: string;
  tokenAddress?: string;
  tokenManagerAddress?: string;
}) {
  return simnet.callPublicFn(
    "interchain-token-factory",
    "register-canonical-interchain-token",
    [
      impl,
      gatewayImplCV,
      itsImpl,
      Cl.address(tokenAddress),
      Cl.address(tokenManagerAddress),
      Cl.uint(1000),
    ],
    sender,
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
      itsImpl,
      Cl.address(tokenAddress),
      Cl.stringAscii(destinationChain),
      Cl.uint(gasValue),
    ],
    sender,
  );
}

export function getInterchainTokenId({
  salt,
  deployer,
  sender,
}: {
  deployer: PrincipalCV;
  salt: BufferCV;
  sender: string;
}) {
  return simnet.callPrivateFn(
    "interchain-token-factory-impl",
    "get-interchain-token-id",
    [itsImpl, deployer, salt],
    sender,
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
      itsImpl,
      Cl.buffer(salt),
      Cl.address(minter),
      Cl.stringAscii(destinationChain),
      Cl.uint(gasValue),
      Cl.address(tokenAddress),
      Cl.address(tokenManagerAddress),
    ],
    sender,
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
    "get-interchain-token-salt",
    [
      Cl.buffer(keccak256(Cl.serialize(Cl.stringAscii("stacks")))),
      Cl.address(deployer),
      Cl.buffer(salt),
    ],
    address1,
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
    sender,
  );
}

const NIT = `${deployer}.native-interchain-token`;
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
    sender,
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
    sender,
  );
}
