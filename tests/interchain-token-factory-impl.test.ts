import { describe, expect, it } from "vitest";
import { gasImplContract, gatewayImplCV, getSigners } from "./util";
import {
  enableTokenManager,
  itsImpl,
  setupNIT,
  setupService,
  setupTokenManager,
} from "./its-utils";
import { Cl, randomBytes } from "@stacks/transactions";
import { ITF_ERRORS } from "./constants";
import { getCanonicalInterChainTokenId } from "./itf-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

describe("Interchain token factory impl", () => {
  it("should only be called by proxy", () => {
    expect(
      simnet.callPublicFn(
        "interchain-token-factory-impl",
        "register-canonical-interchain-token",
        [
          gatewayImplCV,
          gasImplContract,
          itsImpl,
          Cl.address(`${deployer}.sample-sip-010`),
          Cl.address(`${deployer}.token-manager`),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ITF_ERRORS["ERR-NOT-PROXY"]);
    const proofSigners = getSigners(0, 10, 1, 10, "1");
    const tokenId = getCanonicalInterChainTokenId({}).value;
    const salt = randomBytes(32);

    setupService(proofSigners);
    setupTokenManager({});
    enableTokenManager({
      proofSigners,
      tokenId,
    });

    expect(
      simnet.callPublicFn(
        "interchain-token-factory-impl",
        "deploy-remote-canonical-interchain-token",
        [
          gatewayImplCV,
          gasImplContract,
          itsImpl,
          Cl.address(`${deployer}.sample-sip-010`),
          Cl.stringAscii("ethereum"),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ITF_ERRORS["ERR-NOT-PROXY"]);

    expect(
      simnet.callPublicFn(
        "interchain-token-factory-impl",
        "deploy-interchain-token",
        [
          gatewayImplCV,
          gasImplContract,
          itsImpl,
          Cl.buffer(salt),
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.uint(1000),
          Cl.address(deployer),
          Cl.uint(1000),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ITF_ERRORS["ERR-NOT-PROXY"]);

    setupNIT({ tokenId, minter: address1 });
    expect(
      simnet.callPublicFn(
        "interchain-token-factory-impl",
        "deploy-remote-interchain-token",
        [
          gatewayImplCV,
          gasImplContract,
          itsImpl,
          Cl.buffer(salt),
          Cl.address(address1),
          Cl.stringAscii("ethereum"),
          Cl.uint(1000),
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.address(address1),
        ],
        address1,
      ).result,
    ).toBeErr(ITF_ERRORS["ERR-NOT-PROXY"]);
    expect(
      simnet.callPublicFn(
        "interchain-token-factory-impl",
        "dispatch",
        [Cl.stringAscii("fn"), Cl.bufferFromHex("0x"), Cl.address(address1)],
        address1,
      ).result,
    ).toBeErr(ITF_ERRORS["ERR-NOT-PROXY"]);
  });
});
