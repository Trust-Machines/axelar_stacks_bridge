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
  minterHex = "0x" + "00".repeat(20),
  destinationChain = "ethereum",
  gasValue = 100,
  tokenAddress,
  tokenManagerAddress,
  sender = address1,
  impl = itfImpl,
}: {
  impl?: PrincipalCV;
  salt: Buffer | Uint8Array;
  minterHex?: string;
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
      Cl.bufferFromHex(minterHex),
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
