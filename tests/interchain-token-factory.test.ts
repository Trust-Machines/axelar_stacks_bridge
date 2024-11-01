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
import {
  BufferCV,
  Cl,
  cvToString,
  randomBytes,
  ResponseOkCV,
} from "@stacks/transactions";
import { getSigners } from "./util";
import { deployInterchainToken } from "./itf-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/
const proofSigners = getSigners(0, 10, 1, 10, "1");
describe("interchain-token-factory", () => {
  beforeEach(() => {
    setupService(proofSigners);
  });
  it("Should return the correct contract ID", () => {
    const contractId = simnet.callReadOnlyFn(
      "interchain-token-factory",
      "get-contract-id",
      [],
      address1
    ).result as ResponseOkCV<BufferCV>;

    expect(contractId).toBeOk(
      Cl.buffer(
        keccak256(Cl.serialize(Cl.stringAscii("interchain-token-factory")))
      )
    );
  });
  describe("Canonical Interchain Token Factory", () => {
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
  });

  describe("Interchain token factory", () => {
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

      const deployTx = deployInterchainToken({
        salt: originalSalt,
        sender: address1,
      });

      console.log(
        deployTx.events.map((ev) =>
          ev.data.value ? cvToString(ev.data.value!) : ev
        )
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

    it("Should revert an interchain token deployment with the minter as interchainTokenService", () => {});
    it("Should register a token if the mint amount is zero", () => {});
    it("Should register a token if the mint amount is zero and minter is the zero address", () => {});
    it("Should register a token if the mint amount is greater than zero and the minter is the zero address", () => {});
    it("Should register a token", () => {});
    it("Should initiate a remote interchain token deployment with the same minter", () => {});
    it("Should initiate a remote interchain token deployment without the same minter", () => {});
  });
});
