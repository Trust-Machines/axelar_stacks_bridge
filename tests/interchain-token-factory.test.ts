import { beforeEach, describe, expect, it } from "vitest";
import {
  approveDeployNativeInterchainToken,
  enableTokenManager,
  executeDeployInterchainToken,
  keccak256,
  setupNIT,
  setupService,
  setupTokenManager,
} from "./its-utils";
import { BufferCV, Cl, randomBytes, ResponseOkCV } from "@stacks/transactions";
import { getSigners } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/
const proofSigners = getSigners(0, 10, 1, 10, "1");

describe("Interchain token factory", () => {
  beforeEach(() => {
    setupService(proofSigners);
  });
  it("deploys a lock unlock token with its manager", () => {
    setupTokenManager({});

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

  it("deploys a mint burn token", () => {
    const originalSalt = randomBytes(32);
    const salt = simnet.callReadOnlyFn(
      "interchain-token-factory",
      "get-interchain-token-salt",
      [
        Cl.buffer(keccak256(Cl.serialize(Cl.stringAscii("stacks")))),
        Cl.address(address1),
        Cl.buffer(originalSalt),
      ],
      address1
    ).result as BufferCV;
    const tokenId = (
      simnet.callReadOnlyFn(
        "interchain-token-factory",
        "get-interchain-token-id",
        [Cl.address(address1), salt],
        address1
      ).result as ResponseOkCV<BufferCV>
    ).value;

    setupNIT({
      tokenId,
    });

    const deployTx = simnet.callPublicFn(
      "interchain-token-factory",
      "deploy-interchain-token",
      [
        Cl.buffer(originalSalt),
        Cl.address(`${deployer}.native-interchain-token`),
        Cl.uint(0),
        Cl.address("ST000000000000000000002AMW42H"),
        Cl.uint(100),
      ],
      address1
    );

    expect(deployTx.result).toBeOk(Cl.bool(true));

    const { payload } = approveDeployNativeInterchainToken({
      tokenId,
      proofSigners,
    });

    expect(
      executeDeployInterchainToken({
        messageId: "approved-native-interchain-token-deployment-message",
        gasValue: 100,
        payload: Cl.serialize(payload),
        tokenAddress: `${deployer}.native-interchain-token`,
        sourceChain: "stacks",
        sourceAddress: "interchain-token-service",
      }).result
    ).toBeOk(Cl.bool(true));

    const remoteDeployTx = simnet.callPublicFn(
      "interchain-token-factory",
      "deploy-remote-interchain-token",
      [
        Cl.buffer(originalSalt),
        Cl.bufferFromHex("0x" + "00".repeat(20)),
        Cl.stringAscii("ethereum"),
        Cl.uint(100),
        Cl.address(`${deployer}.native-interchain-token`),
        Cl.address(`${deployer}.native-interchain-token`),
      ],
      address1
    );

    expect(remoteDeployTx.result).toBeOk(Cl.bool(true));
  });
});
