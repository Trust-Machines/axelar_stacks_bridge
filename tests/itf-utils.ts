import { Cl } from "@stacks/transactions";
import { gatewayImplCV } from "./util";
const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;

export function deployInterchainToken({
  sender,
  salt,
  tokenAddress = `${deployer}.native-interchain-token`,
  gasValue = 100,
  initialSupply = 0,
  minterAddress = "ST000000000000000000002AMW42H",
}: {
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
      gatewayImplCV,
      Cl.buffer(salt),
      Cl.address(tokenAddress),
      Cl.uint(initialSupply),
      Cl.address(minterAddress),
      Cl.uint(gasValue),
    ],
    sender
  );
}
