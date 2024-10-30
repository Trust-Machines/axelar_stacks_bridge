import { describe, expect, it } from "vitest";
import {
  enableTokenManager,
  getTokenId,
  keccak256,
  setupService,
  setupTokenManager,
} from "./its-utils";
import { BufferCV, Cl, cvToHex, ResponseOkCV } from "@stacks/transactions";
import { getSigners } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/
const proofSigners = getSigners(0, 10, 1, 10, "1");

describe("example tests", () => {
  it("deploys a lock unlock token with its manager", () => {
    setupTokenManager({});
    setupService(proofSigners);
    const salt = simnet.callReadOnlyFn(
      "interchain-token-factory",
      "get-canonical-interchain-token-salt",
      [
        Cl.buffer(keccak256(Cl.serialize(Cl.stringAscii("stacks")))),
        Cl.address(`${deployer}.sample-sip-010`),
      ],
      address1
    ).result as BufferCV;

    const tokenId = (
      simnet.callReadOnlyFn(
        "interchain-token-factory",
        "get-canonical-interchain-token-id",
        [Cl.address(`${deployer}.sample-sip-010`)],
        address1
      ).result as ResponseOkCV<BufferCV>
    ).value;

    const deployTx = simnet.callPublicFn(
      "interchain-token-factory",
      "register-canonical-interchain-token",
      [
        Cl.address(`${deployer}.sample-sip-010`),
        Cl.address(`${deployer}.token-manager`),
        Cl.uint(1000),
      ],
      address1
    );
    expect(deployTx.result).toBeOk(Cl.bool(true));

    enableTokenManager({
      proofSigners,
      tokenId,
    });

    const remoteDeployTx = simnet.callPublicFn(
      "interchain-token-factory",
      "deploy-remote-canonical-interchain-token",
      [
        Cl.address(`${deployer}.sample-sip-010`),
        Cl.stringAscii("ethereum"),
        Cl.uint(100),
      ],
      address1
    );

    expect(remoteDeployTx.result).toBeOk(Cl.bool(true));
  });
});
