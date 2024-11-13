import { describe, expect, it } from "vitest";
import { deployGateway, gatewayImplCV, getSigners } from "./util";
import {
  enableTokenManager,
  getTokenId,
  itsImpl,
  setupNIT,
  setupService,
  setupTokenManager,
} from "./its-utils";
import { BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { ITF_ERRORS } from "./constants";
import { getCanonicalInterChainTokenId } from "./itf-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

describe("Interchain token factory impl", () => {
  it("should only be called by proxy", () => {
    expect(
      simnet.callPublicFn(
        "interchain-token-factory-impl",
        "register-canonical-interchain-token",
        [
          gatewayImplCV,
          itsImpl,
          Cl.address(`${deployer}.sample-sip-010`),
          Cl.address(`${deployer}.token-manager`),
          Cl.uint(1000),
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
          itsImpl,
          Cl.address(`${deployer}.sample-sip-010`),
          Cl.stringAscii("ethereum"),
          Cl.uint(1000),
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
          itsImpl,
          Cl.buffer(salt),
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.uint(1000),
          Cl.principal(deployer),
          Cl.uint(1000),
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
          itsImpl,
          Cl.buffer(salt),
          Cl.bufferFromHex("0xdeadbeef"),
          Cl.stringAscii("ethereum"),
          Cl.uint(1000),
          Cl.address(`${deployer}.native-interchain-token`),
          Cl.address(`${deployer}.native-interchain-token`),
        ],
        address1,
      ).result,
    ).toBeErr(ITF_ERRORS["ERR-NOT-PROXY"]);
    expect(
      simnet.callPublicFn(
        "interchain-token-factory-impl",
        "dispatch",
        [Cl.stringAscii("fn"), Cl.bufferFromHex("0x")],
        address1,
      ).result,
    ).toBeErr(ITF_ERRORS["ERR-NOT-PROXY"]);
  });

  // it("shows an example", () => {
  //   const { result } = simnet.callReadOnlyFn("counter", "get-counter", [], address1);
  //   expect(result).toBeUint(0);
  // });
});
