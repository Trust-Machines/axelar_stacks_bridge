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
import {
  factoryDeployInterchainToken,
  deployRemoteCanonicalInterchainToken,
  factoryDeployRemoteInterchainToken,
  getCanonicalInterChainTokenId,
  getInterchainTokenId,
  registerCanonicalInterchainToken,
} from "./itf-utils";
import { BURN_ADDRESS, ITF_ERRORS } from "./constants";

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
      "interchain-token-factory-impl",
      "get-contract-id",
      [],
      address1,
    ).result as ResponseOkCV<BufferCV>;

    expect(contractId).toBeOk(
      Cl.buffer(
        keccak256(Cl.serialize(Cl.stringAscii("interchain-token-factory"))),
      ),
    );
  });
  describe("Canonical Interchain Token Factory", () => {
    it("deploys a lock unlock token with its manager", () => {
      setupTokenManager({});

      const tokenId = getCanonicalInterChainTokenId({}).value;

      const deployTx = registerCanonicalInterchainToken({});

      expect(deployTx.result).toBeOk(Cl.bool(true));

      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const remoteDeployTx = deployRemoteCanonicalInterchainToken({});

      expect(remoteDeployTx.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Interchain token factory", () => {
    const originalSalt = randomBytes(32);
    const salt = simnet.callReadOnlyFn(
      "interchain-token-factory-impl",
      "get-interchain-token-salt",
      [
        Cl.buffer(keccak256(Cl.serialize(Cl.stringAscii("stacks")))),
        Cl.address(address1),
        Cl.buffer(originalSalt),
      ],
      address1,
    ).result as BufferCV;

    const tokenId = getInterchainTokenId({
      salt,
      deployer: Cl.address(address1),
      sender: address1,
    }).value;
    it("deploys a mint burn token", () => {
      setupNIT({
        tokenId,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
      });

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
        }).result,
      ).toBeOk(Cl.bool(true));

      const remoteDeployTx = factoryDeployRemoteInterchainToken({
        salt: originalSalt,
        tokenAddress: `${deployer}.native-interchain-token`,
        tokenManagerAddress: `${deployer}.token-manager`,
        sender: address1,
      });

      expect(remoteDeployTx.result).toBeOk(Cl.bool(true));
    });

    it("Should revert an interchain token deployment with the minter as interchainTokenService", () => {
      setupNIT({
        tokenId,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: randomBytes(32),
        sender: address1,
        minterAddress: `${deployer}.interchain-token-service-impl`,
      });

      expect(deployTx.result).toBeErr(ITF_ERRORS["ERR-INVALID-MINTER"]);
    });
    it("Should register a token if the mint amount is zero", () => {
      setupNIT({
        tokenId,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        initialSupply: 0,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));
    });
    it("Should register a token if the mint amount is zero and minter is the zero address", () => {
      setupNIT({
        tokenId,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        initialSupply: 0,
        minterAddress: BURN_ADDRESS,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));
    });

    it("Should initiate a remote interchain token deployment without the same minter", () => {
      setupNIT({
        tokenId,
        minter: address1,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        initialSupply: 0,
        minterAddress: address1,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));
      const { payload } = approveDeployNativeInterchainToken({
        tokenId,
        proofSigners,
        minter: address1,
      });

      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          gasValue: 100,
          payload: Cl.serialize(payload),
          tokenAddress: `${deployer}.native-interchain-token`,
          sourceChain: "stacks",
          sourceAddress: "interchain-token-service",
        }).result,
      ).toBeOk(Cl.bool(true));

      const remoteDeployTx = factoryDeployRemoteInterchainToken({
        salt: originalSalt,
        tokenAddress: `${deployer}.native-interchain-token`,
        tokenManagerAddress: `${deployer}.token-manager`,
        sender: address1,
      });

      expect(remoteDeployTx.result).toBeOk(Cl.bool(true));
    });
  });
});
