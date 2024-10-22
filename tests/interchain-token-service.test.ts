import { BufferCV, randomBytes, Cl } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

import {
  buildOutgoingGMPMessage,
  buildVerifyTokenManagerPayload,
  deployRemoteInterchainToken,
  deployTokenManager,
  enableTokenManager,
  executeDeployInterchainToken,
  getTokenId,
  setPaused,
  setupTokenManager,
} from "./its-utils";
import { deployGateway, getSigners } from "./util";
import { ITS_ERROR_CODES } from "./constants";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

const proofSigners = getSigners(0, 10, 1, 10, "1");

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

function setupService() {
  expect(
    simnet.callPublicFn(
      "interchain-token-service",
      "setup",
      [
        Cl.stringAscii("interchain-token-service"),
        Cl.contractPrincipal(deployer, "interchain-token-factory"),
        Cl.contractPrincipal(deployer, "gateway"),
        Cl.contractPrincipal(deployer, "gas-service"),
        Cl.standardPrincipal(deployer),
        Cl.list([
          Cl.tuple({
            "chain-name": Cl.stringAscii("ethereum"),
            address: Cl.stringAscii("cosmwasm"),
          }),
        ]),
      ],
      deployer
    ).result
  ).toBeOk(Cl.bool(true));
  deployGateway(proofSigners);
}
describe("Interchain Token Service", () => {
  beforeEach(setupService);
  describe("Owner functions", () => {
    it("Should revert on set pause status when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-paused",
          [Cl.bool(true)],
          address1
        ).result
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should revert on set trusted address when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [Cl.stringAscii("ethereum"), Cl.stringAscii("cosmwasm")],
          address1
        ).result
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should set trusted address", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [Cl.stringAscii("ethereum"), Cl.stringAscii("cosmwasm")],
          deployer
        ).result
      ).toBeOk(Cl.bool(true));
    });

    it("Should revert on remove trusted address when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [Cl.stringAscii("ethereum")],
          address1
        ).result
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should remove trusted address", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [Cl.stringAscii("ethereum")],
          deployer
        ).result
      ).toBeOk(Cl.bool(true));
    });
  });

  describe("Deploy and Register Interchain Token", () => {
    const salt = randomBytes(32);
    const tokenId = getTokenId(salt).result as BufferCV;

    it("Should register an existing token with its manager", () => {
      setupTokenManager();
      const deployTx = deployTokenManager({
        salt,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(deployTx.events[0].event).toBe("print_event");
      expect(Cl.deserialize(deployTx.events[0].data.raw_value!)).toBeTuple({
        type: Cl.stringAscii("interchain-token-id-claimed"),
        "token-id": tokenId,
        deployer: Cl.standardPrincipal(address1),
        salt: Cl.buffer(salt),
      });
      const payload = buildVerifyTokenManagerPayload({ tokenId });

      const message = buildOutgoingGMPMessage({
        payload,
        destinationChain: "stacks",
        destinationContractAddress: "interchain-token-service",
        sender: Cl.contractPrincipal(deployer, "interchain-token-service"),
      });
      expect(deployTx.events[1].event).toBe("print_event");
      expect(Cl.deserialize(deployTx.events[1].data.raw_value!)).toBeTuple(
        message
      );
      enableTokenManager({
        proofSigners,
        tokenId,
      });
    });

    it("Should revert when registering an interchain token as a lock/unlock for a second time", () => {
      setupTokenManager();
      deployTokenManager({
        salt,
      });

      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const secondDeployTx = deployTokenManager({ salt });
      expect(secondDeployTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-TOKEN-EXISTS"]
      );
    });

    it("Should revert when registering an interchain token when service is paused", () => {
      setupTokenManager();
      expect(setPaused({ paused: true }).result).toBeOk(Cl.bool(true));
      expect(
        deployTokenManager({
          salt,
        }).result
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Deploy and Register remote Interchain Token", () => {
    const salt = randomBytes(32);
    const tokenId = getTokenId(salt).result as BufferCV;
    it("Should initialize a remote interchain token deployment", () => {
      setupTokenManager();
      deployTokenManager({
        salt,
      });

      enableTokenManager({
        proofSigners,
        tokenId,
      });
      expect(
        deployRemoteInterchainToken({
          salt,
          decimals: 6,
          destinationChain: "ethereum",
          gasValue: 10_000_000,
          name: "sample",
          minter: Buffer.from([0]),
          symbol: "sample",
        }).result
      ).toBeOk(Cl.bool(true));
    });

    it("Should revert on remote interchain token deployment if destination chain is not trusted", () => {
      setupTokenManager();
      deployTokenManager({
        salt,
      });

      enableTokenManager({
        proofSigners,
        tokenId,
      });
      expect(
        deployRemoteInterchainToken({
          salt,
          decimals: 6,
          destinationChain: "OneCoin",
          gasValue: 10_000_000,
          name: "sample",
          minter: Buffer.from([0]),
          symbol: "sample",
        }).result
      ).toBeErr(ITS_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });

    it("Should revert on remote interchain token deployment if paused", () => {
      setupTokenManager();
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });

      setPaused({ paused: true });

      expect(
        deployRemoteInterchainToken({
          salt,
          decimals: 6,
          destinationChain: "ethereum",
          gasValue: 10_000_000,
          name: "sample",
          minter: Buffer.from([0]),
          symbol: "sample",
        }).result
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Receive Remote Interchain Token Deployment", () => {
    it("Should revert on receiving a remote interchain token deployment if not approved by the gateway", () => {
      expect(
        executeDeployInterchainToken({
          messageId: "unapproved-message",
          payload: Cl.serialize(
            Cl.tuple({
              type: Cl.uint(2),
              "token-id": Cl.buffer(randomBytes(32)),
              name: Cl.stringAscii("unapproved-token"),
              symbol: Cl.stringAscii("unapproved-token"),
              decimals: Cl.uint(6),
              "minter-bytes": Cl.bufferFromHex("0x00"),
            })
          ),
          sourceAddress: "0x00",
          sourceChain: "ethereum",
          tokenAddress: `${deployer}.sample-sip-010`,
        }).result
      ).toBeErr(ITS_ERROR_CODES["ERR-TOKEN-DEPLOYMENT-NOT-APPROVED"]);
    });

    it("Should be able to receive a remote interchain token deployment with a mint/burn token manager with empty minter and operator", () => {});
  });

  describe("Custom Token Manager Deployment", () => {
    it("Should revert on deploying an invalid token manager", () => {});

    it("Should revert on deploying a local token manager with interchain token manager type", () => {});

    it("Should revert on deploying a remote token manager with interchain token manager type", () => {});

    it("Should revert on deploying a token manager if token handler post deploy fails", () => {});

    it("Should deploy a lock/unlock token manager", () => {});

    it("Should revert when deploying a custom token manager twice", () => {});

    it("Should revert when calling unsupported functions directly on the token manager implementation", () => {});

    it("Should deploy a mint/burn token manager", () => {});

    it("Should deploy a mint/burn_from token manager", () => {});

    it("Should deploy a lock/unlock with fee on transfer token manager", () => {});

    it("Should revert when deploying a custom token manager if paused", () => {});

    it("Should not approve on the second token manager gateway deployment", () => {});
  });

  describe("Initialize remote custom token manager deployment", () => {
    it("Should initialize a remote custom token manager deployment", () => {});

    it("Should revert on a remote custom token manager deployment if the token manager does does not exist", () => {});

    it("Should revert on remote custom token manager deployment if paused", () => {});
  });

  describe("Receive Remote Token Manager Deployment", () => {
    it("Should be able to receive a remote lock/unlock token manager deployment", () => {});

    it("Should be able to receive a remote mint/burn token manager deployment", () => {});

    it("Should not be able to receive a remote interchain token manager deployment", () => {});
  });

  describe("Send Token", () => {
    it("Should be able to initiate an interchain token transfer for lockUnlockFee with a normal ERC20 token", () => {});

    it("Should revert on initiating an interchain token transfer for lockUnlockFee with reentrant token", () => {});

    it("Should revert on initiate interchain token transfer with zero amount", () => {});

    it("Should revert on initiate interchain token transfer when service is paused", () => {});

    it("Should revert on transmit send token when service is paused", () => {});

    it("Should revert on transmit send token when not called by interchain token", () => {});
  });

  describe("Gateway call", () => {
    it("Should revert on initiating an interchain token transfer for gateway token when gateway call failed", () => {});

    it("Should revert on callContractWithInterchainToken when gateway call failed", () => {});
  });

  describe("Execute checks", () => {
    it("Should revert on execute if remote address validation fails", () => {});

    it("Should revert on execute if the service is paused", () => {});

    it("Should revert on execute with invalid messageType", () => {});
  });

  describe("Execute with token checks", () => {
    it("Should revert on execute with token if remote address validation fails", () => {});

    it("Should revert on execute with token if the service is paused", () => {});

    it("Should revert on execute with token with invalid messageType", () => {});
  });

  describe("Receive Remote Tokens", () => {
    it("Should revert with InvalidPayload", () => {});

    it("Should be able to receive lock/unlock token", () => {});

    it("Should be able to receive mint/burn token", () => {});

    it("Should be able to receive lock/unlock with fee on transfer token", () => {});

    it("Should be able to receive lock/unlock with fee on transfer token with normal ERC20 token", () => {});

    it("Should be able to receive gateway token", () => {});
  });

  describe("Send Token With Data", () => {
    it("Should revert on an interchain transfer if service is paused", () => {});

    for (const type of [
      "lockUnlock",
      "mintBurn",
      "lockUnlockFee",
      "mintBurnFrom",
    ]) {
      it(`Should initiate an interchain token transfer via the interchainTransfer standard contract call & express call [${type}]`, () => {});
    }

    it("Should initiate an interchain token transfer via the interchainTransfer standard contract call & express call [gateway]", () => {});

    it("Should revert on callContractWithInterchainToken function on the service if amount is 0", () => {});

    for (const type of ["lockUnlock", "lockUnlockFee"]) {
      it(`Should be able to initiate an interchain token transfer via the interchainTransfer function on the service when the service is approved as well [${type}]`, () => {});
    }

    for (const type of ["lockUnlock", "mintBurn", "lockUnlockFee"]) {
      it(`Should be able to initiate an interchain token transfer via the callContractWithInterchainToken function on the service [${type}]`, () => {});
    }

    it("Should revert on callContractWithInterchainToken if data is empty", () => {});

    it("Should revert on callContractWithInterchainToken function when service is paused", () => {});

    it("Should revert on interchainTransfer function when service is paused", () => {});

    it("Should revert on transferToTokenManager when not called by the correct tokenManager", () => {});

    it("Should revert on interchainTransfer function with invalid metadata version", () => {});

    it("Should revert on callContractWithInterchainToken when destination chain is untrusted chain", () => {});
  });

  describe("Receive Remote Token with Data", () => {
    it("Should be able to receive lock/unlock token", () => {});

    it("Should be able to receive lock/unlock token with empty data and not call destination contract", () => {});

    it("Should be able to receive mint/burn token", () => {});

    it("Should be able to receive mint/burn from token", () => {});

    it("Should be able to receive lock/unlock with fee on transfer token", () => {});

    it("Should revert if token handler transfer token from fails", () => {});

    it("Should revert if execute with interchain token fails", () => {});

    it("Should revert with UntrustedChain when the message type is RECEIVE_FROM_HUB and untrusted chain", () => {});

    it("Should revert with UntrustedChain when the message type is RECEIVE_FROM_HUB and untrusted original source chain", () => {});

    it("Should revert with InvalidPayload when the message type is RECEIVE_FROM_HUB and has invalid inner payload.", () => {});

    it("Should revert with UntrustedChain when receiving a direct message from the ITS Hub. Not supported yet", () => {});
  });

  describe("Send Interchain Token", () => {
    for (const type of [
      "mintBurn",
      "mintBurnFrom",
      "lockUnlockFee",
      "lockUnlock",
    ]) {
      it(`Should be able to initiate an interchain token transfer via interchainTransfer & interchainTransferFrom [${type}]`, () => {});
    }

    it("Should be able to initiate an interchain token transfer using interchainTransferFrom with max possible allowance", () => {});

    it("Should revert using interchainTransferFrom with zero amount", () => {});

    it("Should be able to initiate an interchain token transfer via interchainTransfer & interchainTransferFrom [gateway]", () => {});
  });

  describe("Send Interchain Token With Data", () => {
    for (const type of [
      "lockUnlock",
      "mintBurn",
      "mintBurnFrom",
      "lockUnlockFee",
    ]) {
      it(`Should be able to initiate an interchain token transfer [${type}]`, () => {});
    }

    it("Should be able to initiate an interchain token transfer [gateway]", () => {});
  });

  describe("Express Execute", () => {
    it("Should revert on executeWithInterchainToken when not called by the service", () => {});

    it("Should revert on expressExecuteWithInterchainToken when not called by the service", () => {});

    it("Should revert on express execute when service is paused", () => {});

    it("Should express execute", () => {});

    it("Should revert on express execute if token handler transfer token from fails", () => {});

    it("Should revert on express execute with token if token transfer fails on destination chain", () => {});

    it("Should express execute with token", () => {});
  });

  describe("Express Execute With Token", () => {
    it("Should revert on executeWithInterchainToken when not called by the service", () => {});

    it("Should revert on expressExecuteWithInterchainToken when not called by the service", () => {});

    it("Should revert on express execute with token when service is paused", () => {});

    it("Should express execute with token", () => {});

    it("Should revert on express execute if token handler transfer token from fails", () => {});

    it("Should revert on express execute with token if token transfer fails on destination chain", () => {});

    it("Should express execute with token", () => {});
  });

  describe("Express Receive Remote Token", () => {
    it("Should revert if command is already executed by gateway", () => {});

    it("Should revert with invalid messageType", () => {});

    it("Should be able to receive lock/unlock token", () => {});

    it("Should be able to receive interchain mint/burn token", () => {});

    it("Should be able to receive mint/burn token", () => {});

    it("Should be able to receive mint/burn from token", () => {});

    it("Should be able to receive lock/unlock with fee on transfer token", () => {});

    it("Should be able to receive lock/unlock with fee on transfer token with normal ERC20 token", () => {});

    it("Should be able to receive mint/burn token", () => {});
  });

  describe("Express Receive Remote Token with Data", () => {
    it("Should be able to receive lock/unlock token", () => {});

    it("Should be able to receive interchain mint/burn token", () => {});
    it("Should be able to receive mint/burn token", () => {});

    it("Should be able to receive lock/unlock with fee on transfer token", () => {});
  });

  describe("Flow Limits", () => {
    it("Should be able to send token only if it does not trigger the mint limit", () => {});

    it("Should be able to receive token only if it does not trigger the mint limit", () => {});

    it("Should be able to set flow limits for each token manager", () => {});
  });

  describe("Flow Limiters", () => {
    it("Should have only the owner be a flow limiter", () => {});

    it("Should be able to add a flow limiter", () => {});

    it("Should be able to remove a flow limiter", () => {});

    it("Should be able to transfer a flow limiter", () => {});

    it("Should revert if trying to add a flow limiter as not the operator", () => {});

    it("Should revert if trying to add a flow limiter as not the operator", () => {});

    it("Should be able to transfer a flow limiter and the operator in one call", () => {});
  });

  describe("Call contract value", () => {
    it("Should revert on contractCallValue if not called by remote service", () => {});

    it("Should revert on contractCallValue if service is paused", () => {});

    it("Should revert on invalid express message type", () => {});

    it("Should return correct token address and amount", () => {});
  });

  describe("Call contract with token value", () => {
    it("Should revert on contractCallWithTokenValue if not called by remote service", () => {});

    it("Should revert on contractCallWithTokenValue if service is paused", () => {});

    it("Should revert on invalid express message type", () => {});

    it("Should revert on token missmatch", () => {});

    it("Should revert on amount missmatch", () => {});

    it("Should return correct token address and amount", () => {});
  });

  describe("Bytecode checks [ @skip-on-coverage ]", () => {
    it("Should preserve the same proxy bytecode for each EVM", () => {});
  });
});
