import { beforeEach, describe, expect, it } from "vitest";
import {
  buildOutgoingGMPMessage,
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
  // getCanonicalInterChainTokenId,
  getInterchainTokenId,
  registerCanonicalInterchainToken,
  itfImpl,
  factoryDeployRemoteInterchainTokenWithMinter,
  approveDeployRemoteInterchainToken,
  revokeDeployRemoteInterchainToken,
} from "./itf-utils";
import {
  BURN_ADDRESS,
  ITF_IMPL_ERRORS,
  MessageType,
  ITF_PROXY_ERRORS,
  TRUSTED_ADDRESS,
  TRUSTED_CHAIN,
} from "./constants";
import { getNITMockCv, getTokenManagerMockCv } from "./verification-util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

const proofSigners = getSigners(0, 10, 1, 10, "1");
describe("interchain-token-factory", () => {
  const evilImpl = Cl.address(`${address2}.interchain-token-factory-impl`);

  beforeEach(() => {
    const implCode = simnet
      .getContractSource(`interchain-token-factory-impl`)!
      .replace(/ \./g, ` '${deployer}.`);
    expect(
      simnet.deployContract(
        "interchain-token-factory-impl",
        implCode,
        { clarityVersion: 2 },
        address2,
      ).result,
    ).toBeBool(true);
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
    it("Should revert if an invalid impl is provided", () => {
      const deployTx = registerCanonicalInterchainToken({
        impl: evilImpl,
      });

      expect(deployTx.result).toBeErr(ITF_PROXY_ERRORS["ERR-INVALID-IMPL"]);
    });
    it("deploys a lock unlock token with its manager", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.token-man`,
        operator: null,
        sender: address1,
      });

      // const tokenId = getCanonicalInterChainTokenId({}).value;

      const deployTx = registerCanonicalInterchainToken({
        sender: address1,
        tokenManagerAddress: `${address1}.token-man`,
        verificationParams,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));

      const remoteDeployTx = deployRemoteCanonicalInterchainToken({});

      expect(remoteDeployTx.result).toBeOk(Cl.bool(true));
    });
  });

  describe("Interchain token factory", () => {
    const originalSalt = randomBytes(32);

    const tokenId = getInterchainTokenId({
      salt: Cl.buffer(originalSalt),
      deployer: Cl.address(address1),
      sender: address1,
    }).value;
    it("Should revert if an invalid impl is provided", () => {
      const deployTx = factoryDeployInterchainToken({
        impl: evilImpl,
        salt: originalSalt,
        sender: address1,
      });

      expect(deployTx.result).toBeErr(ITF_PROXY_ERRORS["ERR-INVALID-IMPL"]);

      const remoteDeployTx = factoryDeployRemoteInterchainToken({
        salt: originalSalt,
        tokenAddress: `${address1}.nit`,
        tokenManagerAddress: `${deployer}.token-manager`,
        sender: address1,
        impl: evilImpl,
      });

      expect(remoteDeployTx.result).toBeErr(ITF_PROXY_ERRORS["ERR-INVALID-IMPL"]);
    });
    it("deploys a mint burn token", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        contract: `${address1}.nit`,
        minter: address1,
        operator: address1,
        sender: address1,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        verificationParams,
        tokenAddress: `${address1}.nit`,
        minterAddress: address1,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));

      const remoteDeployTx = factoryDeployRemoteInterchainToken({
        salt: originalSalt,
        tokenAddress: `${address1}.nit`,
        tokenManagerAddress: `${address1}.nit`,
        sender: address1,
        minter: BURN_ADDRESS,
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

      expect(deployTx.result).toBeErr(ITF_IMPL_ERRORS["ERR-INVALID-MINTER"]);
    });
    it("Should register a token if the mint amount is zero", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        contract: `${address1}.nit`,
        minter: address1,
        operator: address1,
        sender: address1,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        initialSupply: 0,
        minterAddress: address1,
        tokenAddress: `${address1}.nit`,
        verificationParams,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));
    });
    it("Should register a token if the mint amount is zero and minter is the zero address", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        contract: `${address1}.nit`,
        minter: BURN_ADDRESS,
        operator: BURN_ADDRESS,
        sender: address1,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        initialSupply: 0,
        minterAddress: BURN_ADDRESS,
        tokenAddress: `${address1}.nit`,
        verificationParams,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));
    });

    it("Should initiate a remote interchain token deployment without the same minter", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        contract: `${address1}.nit`,
        sender: address1,
        operator: address1,
      });
      const deployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        initialSupply: 0,
        minterAddress: address1,
        verificationParams,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));

      let remoteDeployTx = factoryDeployRemoteInterchainTokenWithMinter({
        salt: originalSalt,
        tokenAddress: `${address1}.nit`,
        tokenManagerAddress: `${address1}.nit`,
        sender: address1,
        minter: address1,
        destinationMinter: "0x" + "00".repeat(20),
      });

      expect(remoteDeployTx.result).toBeErr(
        ITF_IMPL_ERRORS["ERR-REMOTE-DEPLOYMENT-NOT-APPROVED"],
      );
      remoteDeployTx = factoryDeployRemoteInterchainTokenWithMinter({
        salt: originalSalt,
        tokenAddress: `${address1}.nit`,
        tokenManagerAddress: `${deployer}.token-manager`,
        sender: address1,
        minter: BURN_ADDRESS,
        destinationMinter: "0x" + "00".repeat(20),
      });

      expect(remoteDeployTx.result).toBeErr(ITF_IMPL_ERRORS["ERR-INVALID-MINTER"]);
      let approvalTx = approveDeployRemoteInterchainToken({
        deployer: address1,
        salt: originalSalt,
        sender: address1,
        destinationMinter: "0x" + "00".repeat(20),
        destinationChain: "untrusted-chain",
      });

      expect(approvalTx.result).toBeErr(ITF_IMPL_ERRORS["ERR-INVALID-CHAIN-NAME"]);

      approvalTx = approveDeployRemoteInterchainToken({
        deployer: address1,
        salt: originalSalt,
        sender: address2,
        destinationMinter: "0x" + "00".repeat(20),
        destinationChain: "ethereum",
      });

      expect(approvalTx.result).toBeErr(ITF_IMPL_ERRORS["ERR-NOT-MINTER"]);
      approvalTx = approveDeployRemoteInterchainToken({
        deployer: address1,
        salt: originalSalt,
        sender: address1,
        destinationMinter: "0xdeadbeef",
        destinationChain: "ethereum",
      });

      expect(approvalTx.result).toBeOk(Cl.bool(true));

      const [approvalEvent] = approvalTx.events;
      expect(approvalEvent.data.value).toBeTuple({
        type: Cl.stringAscii("deploy-remote-interchain-token-approval"),
        minter: Cl.address(address1),
        deployer: Cl.address(address1),
        "token-id": tokenId,
        "destination-chain": Cl.stringAscii("ethereum"),
        "destination-minter": Cl.bufferFromHex("0xdeadbeef"),
      });

      let revokeTx = revokeDeployRemoteInterchainToken({
        deployer: address1,
        salt: originalSalt,
        destinationChain: "ethereum",
        sender: address1,
      });

      expect(revokeTx.result).toBeOk(Cl.bool(true));

      const [revokeEvent] = revokeTx.events;
      expect(revokeEvent.data.value).toBeTuple({
        type: Cl.stringAscii("revoked-deploy-remote-interchain-token-approval"),
        minter: Cl.address(address1),
        deployer: Cl.address(address1),
        "token-id": tokenId,
        "destination-chain": Cl.stringAscii("ethereum"),
      });

      remoteDeployTx = factoryDeployRemoteInterchainTokenWithMinter({
        salt: originalSalt,
        sender: address1,
        destinationChain: "ethereum",
        destinationMinter: "0xdeadbeef",
        tokenAddress: `${address1}.nit`,
        tokenManagerAddress: `${address1}.nit`,
      });

      expect(remoteDeployTx.result).toBeErr(
        ITF_IMPL_ERRORS["ERR-REMOTE-DEPLOYMENT-NOT-APPROVED"],
      );

      approvalTx = approveDeployRemoteInterchainToken({
        deployer: address1,
        salt: originalSalt,
        sender: address1,
        destinationMinter: "0xdeadbeef",
        destinationChain: "ethereum",
      });

      expect(approvalTx.result).toBeOk(Cl.bool(true));

      remoteDeployTx = factoryDeployRemoteInterchainTokenWithMinter({
        salt: originalSalt,
        sender: address1,
        destinationChain: "ethereum",
        destinationMinter: "0xdeadbeef",
        tokenAddress: `${address1}.nit`,
        tokenManagerAddress: `${address1}.nit`,
      });

      expect(remoteDeployTx.result).toBeOk(Cl.bool(true));
      const payload = Cl.tuple({
        "destination-chain": Cl.stringAscii("ethereum"),
        type: Cl.uint(MessageType.SEND_TO_HUB),
        payload: Cl.buffer(
          Cl.serialize(
            Cl.tuple({
              type: Cl.uint(MessageType.DEPLOY_INTERCHAIN_TOKEN),
              "token-id": tokenId,
              name: Cl.stringAscii("Nitter"),
              symbol: Cl.stringAscii("NIT"),
              decimals: Cl.uint(6),
              minter: Cl.bufferFromHex("0xdeadbeef"),
            }),
          ),
        ),
      });
      const [
        deploymentNotification,
        gasStxTransferEvent,
        gasPaidNotification,
        gmpMessage,
      ] = remoteDeployTx.events;
      expect(deploymentNotification.data.value).toBeTuple({
        type: Cl.stringAscii("interchain-token-deployment-started"),
        name: Cl.stringAscii("Nitter"),
        symbol: Cl.stringAscii("NIT"),
        minter: Cl.bufferFromHex("0xdeadbeef"),
        "token-id": tokenId,
        "destination-chain": Cl.stringAscii("ethereum"),
        decimals: Cl.uint(6),
      });
      expect(gasStxTransferEvent.data).toStrictEqual({
        amount: "100",
        memo: "",
        recipient: `${deployer}.gas-impl`,
        sender: address1,
      });
      expect(gasPaidNotification.data.value).toBeTuple({
        amount: Cl.uint(100),
        "destination-chain": Cl.stringAscii(TRUSTED_CHAIN),
        "destination-address": Cl.stringAscii(TRUSTED_ADDRESS),
        "payload-hash": Cl.buffer(keccak256(Cl.serialize(payload))),
        "refund-address": Cl.address(address1),
        sender: Cl.address(`${deployer}.interchain-token-service`),
        type: Cl.stringAscii("native-gas-paid-for-contract-call"),
      });
      expect(gmpMessage.data.value).toBeTuple(
        buildOutgoingGMPMessage({
          destinationChain: TRUSTED_CHAIN,
          destinationContractAddress: TRUSTED_ADDRESS,
          payload,
          sender: Cl.address(`${deployer}.interchain-token-service`),
        }),
      );
    });

    it("dynamic dispatch", () => {
      const { result } = simnet.callPublicFn(
        "interchain-token-factory",
        "call",
        [itfImpl, Cl.stringAscii("foo"), Cl.bufferFromHex("0x00")],
        address1,
      );
      expect(result).toBeErr(ITF_IMPL_ERRORS['ERR-NOT-IMPLEMENTED'])
    });
  });
});
