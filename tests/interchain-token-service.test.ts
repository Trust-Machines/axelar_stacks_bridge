import {
  BufferCV,
  randomBytes,
  Cl,
  ContractPrincipalCV,
  TupleCV,
} from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

import {
  addFlowLimiter,
  approveDeployNativeInterchainToken,
  approveReceiveInterchainTransfer,
  approveRemoteInterchainToken,
  buildFtTransferEvent,
  buildIncomingInterchainTransferPayload,
  buildOutgoingGMPMessage,
  buildSTXTransferEvent,
  buildVerifyTokenManagerPayload,
  callContractWithInterchainToken,
  deployInterchainToken,
  deployRemoteInterchainToken,
  deployTokenManager,
  enableTokenManager,
  executeDeployInterchainToken,
  executeDeployTokenManager,
  executeReceiveInterchainToken,
  getFlowLimit,
  getSip010Balance,
  getTokenId,
  interchainTransfer,
  isFlowLimiter,
  isOperator,
  itsImpl,
  keccak256,
  mintNIT,
  removeFlowLimiter,
  setFlowLimit,
  setPaused,
  setTokenFlowLimit,
  setupNIT,
  setupService,
  setupTokenManager,
  transferITSOperatorShip,
  transferTokenOperatorShip,
} from "./its-utils";
import { getSigners } from "./util";
import {
  ITS_ERROR_CODES,
  ITS_HUB_ROUTING_IDENTIFIER,
  MessageType,
  MetadataVersion,
  NIT_ERRORS,
  TOKEN_MANAGER_ERRORS,
  TokenType,
  TRUSTED_ADDRESS,
  TRUSTED_CHAIN,
} from "./constants";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

const proofSigners = getSigners(0, 10, 1, 10, "1");

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

describe("Interchain Token Service", () => {
  const salt = randomBytes(32);
  const tokenId = getTokenId(salt).result as BufferCV;

  beforeEach(() => {
    setupService(proofSigners);
  });
  describe("Owner functions", () => {
    it("Should revert on set pause status when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-paused",
          [itsImpl, Cl.bool(true)],
          address1,
        ).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should revert on set trusted address when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [
            itsImpl,
            Cl.stringAscii("ethereum"),
            Cl.stringAscii(ITS_HUB_ROUTING_IDENTIFIER),
          ],
          address1,
        ).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should only be allowed to set 'hub' as the trusted address if not the ITS hub chain", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [itsImpl, Cl.stringAscii("ethereum"), Cl.stringAscii("any other")],
          deployer,
        ).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-INVALID-DESTINATION-ADDRESS"]);

      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [
            itsImpl,
            Cl.stringAscii("ethereum"),
            Cl.stringAscii(ITS_HUB_ROUTING_IDENTIFIER),
          ],
          deployer,
        ).result,
      ).toBeOk(Cl.bool(true));
    });

    it("Should allow ITS hub chain to set whatever address", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [
            itsImpl,
            Cl.stringAscii(TRUSTED_CHAIN),
            Cl.stringAscii("any arbitrary address"),
          ],
          deployer,
        ).result,
      ).toBeOk(Cl.bool(true));
    });

    it("Should revert on remove trusted address when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [itsImpl, Cl.stringAscii("ethereum")],
          address1,
        ).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should remove trusted address", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [itsImpl, Cl.stringAscii("ethereum")],
          deployer,
        ).result,
      ).toBeOk(Cl.bool(true));
    });
  });

  describe("Deploy and Register Interchain Token", () => {
    it("Should register an existing token with its manager", () => {
      setupTokenManager({});
      const deployTx = deployTokenManager({
        salt,
        gas: 1000,
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
      expect(deployTx.events[3].event).toBe("print_event");
      expect(Cl.deserialize(deployTx.events[3].data.raw_value!)).toBeTuple(
        message,
      );
      enableTokenManager({
        proofSigners,
        tokenId,
      });
    });

    it("Should register a native interchain token", () => {
      setupNIT({ tokenId });
      const deployTx = deployInterchainToken({ salt, gasValue: 1000 });

      const { payload } = approveDeployNativeInterchainToken({
        proofSigners,
        tokenId,
      });

      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(payload),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      expect(deployTx.result).toBeOk(Cl.bool(true));
    });

    it("Should revert when registering an interchain token when service is paused", () => {
      setPaused({ paused: true });
      expect(deployInterchainToken({ salt, gasValue: 1000 }).result).toBeErr(
        ITS_ERROR_CODES["ERR-PAUSED"],
      );
    });
  });

  describe("Deploy and Register remote Interchain Token", () => {
    const tokenId = getTokenId(salt).result as BufferCV;
    it("Should initialize a remote interchain token deployment", () => {
      setupTokenManager({});
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
        }).result,
      ).toBeOk(Cl.bool(true));
    });

    it("Should revert on remote interchain token deployment if destination chain is not trusted", () => {
      setupTokenManager({});
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
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });

    it("Should revert on remote interchain token deployment if paused", () => {
      setupTokenManager({});
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
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Receive Remote Interchain Token Deployment", () => {
    const tokenId = getTokenId(salt).result as BufferCV;
    it("Should revert on receiving a remote interchain token deployment if not approved by the gateway", () => {
      expect(
        executeDeployInterchainToken({
          messageId: "unapproved-message",
          payload: Cl.serialize(
            Cl.tuple({
              type: Cl.uint(MessageType.DEPLOY_TOKEN_MANAGER),
              "source-chain": Cl.stringAscii("ethereum"),
              "token-id": Cl.buffer(randomBytes(32)),
              name: Cl.stringAscii("unapproved-token"),
              symbol: Cl.stringAscii("unapproved-token"),
              decimals: Cl.uint(6),
              "minter-bytes": Cl.bufferFromHex("0x00"),
            }),
          ),
          sourceAddress: TRUSTED_ADDRESS,
          sourceChain: TRUSTED_CHAIN,
          tokenAddress: `${deployer}.sample-sip-010`,
          gasValue: 1000,
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-TOKEN-DEPLOYMENT-NOT-APPROVED"]);
    });

    it("Should be able to receive a remote interchain token deployment with a mint/burn token manager with empty minter and operator", () => {
      const { payload } = approveRemoteInterchainToken({
        proofSigners,
        tokenId,
      });
      expect(
        executeDeployInterchainToken({
          messageId: "approved-interchain-token-deployment-message",
          payload: Cl.serialize(payload),
          sourceAddress: TRUSTED_ADDRESS,
          sourceChain: TRUSTED_CHAIN,
          tokenAddress: `${deployer}.sample-sip-010`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));
    });
  });

  describe("Custom Token Manager Deployment", () => {
    it("Should revert on deploying a local token manager with interchain token manager type", () => {
      setupTokenManager({});
      expect(
        deployTokenManager({
          salt,
          tokenType: 0,
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-UNSUPPORTED-TOKEN-TYPE"]);
    });

    it("Should revert when deploying a custom token manager twice", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });

      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const secondDeployTx = deployTokenManager({ salt });
      expect(secondDeployTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-TOKEN-EXISTS"],
      );
    });

    it("Should revert when deploying a custom token manager if paused", () => {
      setupTokenManager({});
      expect(setPaused({ paused: true }).result).toBeOk(Cl.bool(true));
      expect(
        deployTokenManager({
          salt,
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Initialize remote custom token manager deployment", () => {
    it("Should initialize a remote custom token manager deployment", () => {
      setupTokenManager({});
      const tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010");
      const deployTokenManagerTx = deployTokenManager({
        salt,
        destinationChain: "ethereum",
        gas: 100,
        tokenAddress,
      });
      expect(deployTokenManagerTx.result).toBeOk(Cl.bool(true));

      expect(deployTokenManagerTx.events.length).toBe(5);
      const [
        interchainTokenIdClaimed,
        tokenManagerDeploymentStarted,
        stxTransfer,
        nativeGasPaidForContractCall,
        gatewayContractCall,
      ] = deployTokenManagerTx.events;
      const wrappedITSPayload = {
        "destination-chain": Cl.stringAscii("ethereum"),
        "token-id": tokenId,
        "token-manager-type": Cl.uint(TokenType.LOCK_UNLOCK),
        type: Cl.stringAscii("token-manager-deployment-started"),
        params: Cl.buffer(
          Cl.serialize(
            Cl.tuple({
              operator: Cl.some(Cl.address(address1)),
              "token-address": tokenAddress,
            }),
          ),
        ),
      };
      expect(interchainTokenIdClaimed.data.value).toBeTuple({
        deployer: Cl.address(address1),
        salt: Cl.buffer(salt),
        "token-id": tokenId,
        type: Cl.stringAscii("interchain-token-id-claimed"),
      });
      expect(tokenManagerDeploymentStarted.data.value).toBeTuple(
        wrappedITSPayload,
      );

      expect(stxTransfer.data).toStrictEqual({
        amount: "100",
        memo: "",
        recipient: `${deployer}.gas-service`,
        sender: address1,
      });
      const messageData = {
        destinationChain: TRUSTED_CHAIN,
        destinationContractAddress: TRUSTED_ADDRESS,
        payload: Cl.tuple({
          "destination-chain": Cl.stringAscii("ethereum"),
          type: Cl.uint(3),
          payload: Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(MessageType.DEPLOY_TOKEN_MANAGER),
                "token-id": tokenId,
                "token-manager-type": Cl.uint(TokenType.LOCK_UNLOCK),
                params: wrappedITSPayload.params,
              }),
            ),
          ),
        }),
        sender: Cl.contractPrincipal(deployer, "interchain-token-service"),
      };
      const message = buildOutgoingGMPMessage(messageData);
      expect(nativeGasPaidForContractCall.data.value).toBeTuple({
        type: Cl.stringAscii("native-gas-paid-for-contract-call"),
        amount: Cl.uint(100),
        sender: Cl.contractPrincipal(deployer, "interchain-token-service"),
        "refund-address": Cl.address(address1),
        "destination-chain": Cl.stringAscii(TRUSTED_CHAIN),
        "destination-address": Cl.stringAscii(TRUSTED_ADDRESS),
        "payload-hash": Cl.buffer(keccak256(Cl.serialize(messageData.payload))),
      });
      expect(gatewayContractCall.data.value).toBeTuple(message);
    });

    it("Should revert on remote custom token manager deployment if paused", () => {
      setPaused({ paused: true });
      setupTokenManager({});
      const tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010");
      const deployTokenManagerTx = deployTokenManager({
        salt,
        destinationChain: "ethereum",
        gas: 100,
        tokenAddress,
      });
      expect(deployTokenManagerTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-PAUSED"],
      );
    });
  });

  describe("Receive Remote Token Manager Deployment", () => {
    it("Should be able to receive a remote lock/unlock token manager deployment", () => {
      setupTokenManager({});
      const messageId = "remote-token-manager-deployment";
      const wrappedMessageId = "wrapped-" + messageId;
      const tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010");
      const tokenManagerAddress = Cl.contractPrincipal(
        deployer,
        "token-manager",
      );
      const payload = {
        type: Cl.uint(3),
        "source-chain": Cl.stringAscii("ethereum"),
        "token-id": tokenId,
        "token-manager-type": Cl.uint(TokenType.LOCK_UNLOCK),
        params: Cl.buffer(
          Cl.serialize(
            Cl.tuple({
              operator: Cl.some(Cl.address(address1)),
              "token-address": tokenAddress,
            }),
          ),
        ),
      };
      const deployTx = executeDeployTokenManager({
        messageId: wrappedMessageId,
        payload: payload,
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        token: tokenAddress,
        tokenManager: tokenManagerAddress,
        gasValue: 1000,
      });

      const wrappedPayload = {
        "message-id": Cl.stringAscii(wrappedMessageId),
        "source-address": Cl.stringAscii(TRUSTED_ADDRESS),
        "source-chain": Cl.stringAscii(TRUSTED_CHAIN),
        payload: Cl.buffer(Cl.serialize(Cl.tuple(payload))),
      };
      expect(deployTx.result).toBeOk(Cl.bool(true));
      const verifyPayload = buildVerifyTokenManagerPayload({
        tokenId,
        wrappedPayload,
      });
      const message = buildOutgoingGMPMessage({
        payload: verifyPayload,
        destinationChain: "stacks",
        destinationContractAddress: "interchain-token-service",
        sender: Cl.contractPrincipal(deployer, "interchain-token-service"),
      });
      expect(deployTx.events[2].event).toBe("print_event");
      expect(Cl.deserialize(deployTx.events[2].data.raw_value!)).toBeTuple(
        message,
      );
      enableTokenManager({
        messageId,
        proofSigners,
        tokenId,
        wrappedPayload,
      });
    });

    it("Should not be able to receive a remote mint/burn token manager deployment", () => {
      setupTokenManager({
        tokenType: TokenType.MINT_BURN,
      });
      const messageId = "remote-token-manager-deployment";
      const wrappedMessageId = "wrapped-" + messageId;
      const tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010");
      const tokenManagerAddress = Cl.contractPrincipal(
        deployer,
        "token-manager",
      );
      const payload = {
        type: Cl.uint(3),
        "source-chain": Cl.stringAscii("ethereum"),
        "token-id": tokenId,
        "token-manager-type": Cl.uint(TokenType.MINT_BURN),
        params: Cl.buffer(
          Cl.serialize(
            Cl.tuple({
              operator: Cl.some(Cl.address(address1)),
              "token-address": tokenAddress,
            }),
          ),
        ),
      };
      const deployTx = executeDeployTokenManager({
        messageId: wrappedMessageId,
        payload: payload,
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        token: tokenAddress,
        tokenManager: tokenManagerAddress,
        gasValue: 1000,
      });
      expect(deployTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-UNSUPPORTED-TOKEN-TYPE"],
      );
    });

    it("Should not be able to receive a remote interchain token manager deployment", () => {
      expect(
        setupTokenManager({
          tokenType: TokenType.NATIVE_INTERCHAIN_TOKEN,
        }).result,
      ).toBeOk(Cl.bool(true));
      const messageId = "remote-token-manager-deployment";
      const wrappedMessageId = "wrapped-" + messageId;
      const tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010");
      const tokenManagerAddress = Cl.contractPrincipal(
        deployer,
        "token-manager",
      );
      const payload = {
        type: Cl.uint(3),
        "source-chain": Cl.stringAscii("ethereum"),
        "token-id": tokenId,
        "token-manager-type": Cl.uint(TokenType.NATIVE_INTERCHAIN_TOKEN),
        params: Cl.buffer(
          Cl.serialize(
            Cl.tuple({
              operator: Cl.some(Cl.address(address1)),
              "token-address": tokenAddress,
            }),
          ),
        ),
      };
      const deployTx = executeDeployTokenManager({
        messageId: wrappedMessageId,
        payload: payload,
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        token: tokenAddress,
        tokenManager: tokenManagerAddress,
        gasValue: 1000,
      });
      expect(deployTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-UNSUPPORTED-TOKEN-TYPE"],
      );
    });
  });

  describe("Send Token", () => {
    it("Should be able to initiate an interchain token transfer for lockUnlock with a normal SIP-010 token", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });

      enableTokenManager({
        proofSigners,
        tokenId,
      });
      const amount = 1000;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${deployer}.token-manager`;
      const senderInitialBalance = getSip010Balance({
        address: deployer,
        contractAddress: "sample-sip-010",
      });
      const transferTx = interchainTransfer({
        amount: Cl.uint(amount),
        destinationAddress: Cl.bufferFromAscii(destinationAddress),
        destinationChain: Cl.stringAscii(destinationChain),
        gasValue: Cl.uint(gasValue),
        tokenAddress: Cl.address(tokenAddress),
        tokenId,
        tokenManagerAddress: Cl.address(managerAddress),
        caller: deployer,
      });
      const [
        ftTransfer,
        itsTransferAnnouncement,
        gasTransfer,
        _nativeGasPaidForContractCall,
        gatewayContractCall,
      ] = transferTx.events;
      expect(transferTx.result).toBeOk(Cl.bool(true));

      const senderFinalBalance = getSip010Balance({
        address: deployer,
        contractAddress: "sample-sip-010",
      });
      expect(BigInt(senderInitialBalance) - BigInt(amount)).toBe(
        senderFinalBalance,
      );

      expect(ftTransfer).toStrictEqual(
        buildFtTransferEvent({
          amount,
          recipient: managerAddress,
          sender: deployer,
          tokenName: "itscoin",
          tokenAddress,
        }),
      );
      expect(gasTransfer).toStrictEqual(
        buildSTXTransferEvent({
          amount: gasValue,
          recipient: `${deployer}.gas-service`,
          sender: deployer,
        }),
      );
      expect(itsTransferAnnouncement.data.value).toBeTuple({
        type: Cl.stringAscii("interchain-transfer"),
        "token-id": tokenId,
        "source-address": Cl.address(deployer),
        "destination-chain": Cl.stringAscii(destinationChain),
        "destination-address": Cl.bufferFromAscii(destinationAddress),
        amount: Cl.uint(amount),
        data: Cl.bufferFromHex("0x" + "00".repeat(32)),
      });
      expect(gatewayContractCall.data.value).toBeTuple(
        buildOutgoingGMPMessage({
          destinationChain: TRUSTED_CHAIN,
          destinationContractAddress: TRUSTED_ADDRESS,
          sender: Cl.address(`${deployer}.interchain-token-service`),
          payload: Cl.tuple({
            "destination-chain": Cl.stringAscii(destinationChain),
            type: Cl.uint(MessageType.SEND_TO_HUB),
            payload: Cl.buffer(
              Cl.serialize(
                Cl.tuple({
                  type: Cl.uint(MessageType.INTERCHAIN_TRANSFER),
                  "token-id": tokenId,
                  "source-address": Cl.address(deployer),
                  "destination-address": Cl.bufferFromAscii(destinationAddress),
                  amount: Cl.uint(amount),
                  data: Cl.bufferFromHex("0x"),
                }),
              ),
            ),
          }),
        }),
      );
    });

    // it("Should revert on initiating an interchain token transfer for lockUnlockFee with reentrant token", () => {});

    it("Should revert on initiate interchain token transfer with zero amount", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });

      enableTokenManager({
        proofSigners,
        tokenId,
      });
      expect(
        interchainTransfer({
          amount: Cl.uint(0),
          destinationAddress: Cl.bufferFromHex("0x00"),
          destinationChain: Cl.stringAscii("ethereum"),
          gasValue: Cl.uint(100),
          tokenAddress: Cl.contractPrincipal(deployer, "sample-sip-010"),
          tokenId,
          tokenManagerAddress: Cl.contractPrincipal(deployer, "token-manager"),
          caller: deployer,
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-ZERO-AMOUNT"]);
    });

    it("Should revert on initiate interchain token transfer when service is paused", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });

      enableTokenManager({
        proofSigners,
        tokenId,
      });

      setPaused({ paused: true });
      expect(
        interchainTransfer({
          amount: Cl.uint(0),
          destinationAddress: Cl.bufferFromHex("0x00"),
          destinationChain: Cl.stringAscii("ethereum"),
          gasValue: Cl.uint(100),
          tokenAddress: Cl.contractPrincipal(deployer, "sample-sip-010"),
          tokenId,
          tokenManagerAddress: Cl.contractPrincipal(deployer, "token-manager"),
          caller: deployer,
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Execute checks", () => {
    it("Should revert on execute deploy token manager if remote address validation fails", () => {
      setupTokenManager({
        tokenType: TokenType.NATIVE_INTERCHAIN_TOKEN,
      });
      const messageId = "remote-token-manager-deployment";
      const wrappedMessageId = "wrapped-" + messageId;
      const tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010");
      const tokenManagerAddress = Cl.contractPrincipal(
        deployer,
        "token-manager",
      );
      const payload = {
        type: Cl.uint(3),
        "source-chain": Cl.stringAscii("ethereum"),
        "token-id": tokenId,
        "token-manager-type": Cl.uint(TokenType.LOCK_UNLOCK),
        params: Cl.buffer(
          Cl.serialize(
            Cl.tuple({
              operator: Cl.some(Cl.address(address1)),
              "token-address": tokenAddress,
            }),
          ),
        ),
      };
      const deployTx = executeDeployTokenManager({
        messageId: wrappedMessageId,
        payload: payload,
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: "untrusted address",
        token: tokenAddress,
        tokenManager: tokenManagerAddress,
        gasValue: 1000,
      });
      expect(deployTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-NOT-REMOTE-SERVICE"],
      );
    });

    it("Should revert on execute deploy remote interchain token if remote address validation fails", () => {
      const { payload } = approveRemoteInterchainToken({
        proofSigners,
        tokenId,
      });
      expect(
        executeDeployInterchainToken({
          messageId: "approved-interchain-token-deployment-message",
          payload: Cl.serialize(payload),
          sourceAddress: "untrusted address",
          sourceChain: TRUSTED_CHAIN,
          tokenAddress: `${deployer}.sample-sip-010`,
          gasValue: 1000,
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-REMOTE-SERVICE"]);
    });

    it("Should revert on execute receive interchain token if remote address validation fails", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "interchain-transfer-received",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: "untrusted address",
          tokenManager: Cl.contractPrincipal(deployer, "token-manager"),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(3),
                "token-id": tokenId,
                "source-chain": Cl.stringAscii("ethereum"),
                "source-address": Cl.buffer(Cl.serialize(Cl.address(deployer))),
                "destination-address": Cl.buffer(
                  Cl.serialize(Cl.address(address1)),
                ),
                amount: Cl.uint(1000),
                data: Cl.bufferFromHex("0x"),
              }),
            ),
          ),
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-NOT-REMOTE-SERVICE"]);
    });

    it("Should revert on execute deploy token manager if the service is paused", () => {
      setupTokenManager({
        tokenType: TokenType.NATIVE_INTERCHAIN_TOKEN,
      });
      const messageId = "remote-token-manager-deployment";
      const wrappedMessageId = "wrapped-" + messageId;
      const tokenAddress = Cl.contractPrincipal(deployer, "sample-sip-010");
      const tokenManagerAddress = Cl.contractPrincipal(
        deployer,
        "token-manager",
      );
      const payload = {
        type: Cl.uint(3),
        "source-chain": Cl.stringAscii("ethereum"),
        "token-id": tokenId,
        "token-manager-type": Cl.uint(TokenType.LOCK_UNLOCK),
        params: Cl.buffer(
          Cl.serialize(
            Cl.tuple({
              operator: Cl.some(Cl.address(address1)),
              "token-address": tokenAddress,
            }),
          ),
        ),
      };
      setPaused({ paused: true });
      const deployTx = executeDeployTokenManager({
        messageId: wrappedMessageId,
        payload: payload,
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        token: tokenAddress,
        tokenManager: tokenManagerAddress,
        gasValue: 1000,
      });
      expect(deployTx.result).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should revert on execute deploy interchain token if the service is paused", () => {
      const { payload } = approveRemoteInterchainToken({
        proofSigners,
        tokenId,
      });
      setPaused({ paused: true });
      expect(
        executeDeployInterchainToken({
          messageId: "approved-interchain-token-deployment-message",
          payload: Cl.serialize(payload),
          sourceAddress: TRUSTED_ADDRESS,
          sourceChain: TRUSTED_CHAIN,
          tokenAddress: `${deployer}.sample-sip-010`,
          gasValue: 1000,
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should revert on execute receive interchain token if the service is paused", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });
      setPaused({ paused: true });
      expect(
        executeReceiveInterchainToken({
          messageId: "interchain-transfer-received",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.contractPrincipal(deployer, "token-manager"),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(MessageType.INTERCHAIN_TRANSFER),
                "token-id": tokenId,
                "source-chain": Cl.stringAscii("ethereum"),
                "source-address": Cl.buffer(Cl.serialize(Cl.address(deployer))),
                "destination-address": Cl.buffer(
                  Cl.serialize(Cl.address(address1)),
                ),
                amount: Cl.uint(1000),
                data: Cl.bufferFromHex("0x"),
              }),
            ),
          ),
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Receive Remote Tokens", () => {
    it("Should be able to receive lock/unlock token", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${deployer}.token-manager`;
      const recipientInitialBalance = getSip010Balance({
        address: recipient,
        contractAddress: tokenAddress,
      });

      const senderInitialBalance = getSip010Balance({
        address: sender,
        contractAddress: tokenAddress,
      });

      expect(
        interchainTransfer({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromAscii(destinationAddress),
          destinationChain: Cl.stringAscii(destinationChain),
          gasValue: Cl.uint(gasValue),
          tokenAddress: Cl.address(tokenAddress),
          tokenId,
          tokenManagerAddress: Cl.address(managerAddress),
          caller: deployer,
        }).result,
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.contractPrincipal(deployer, "token-manager"),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeOk(Cl.bufferFromHex("0x"));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      const senderFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: sender,
      });
      expect(recipientFinalBalance).toBe(
        recipientInitialBalance + BigInt(amount),
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });

    it("Should be able to receive mint/burn token", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.native-interchain-token`;

      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      expect(
        mintNIT({
          amount,
          minter: deployer,
        }).result,
      ).toBeOk(Cl.bool(true));
      const recipientInitialBalance = getSip010Balance({
        address: recipient,
        contractAddress: tokenAddress,
      });

      const senderInitialBalance = getSip010Balance({
        address: sender,
        contractAddress: tokenAddress,
      });

      expect(
        interchainTransfer({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromAscii(destinationAddress),
          destinationChain: Cl.stringAscii(destinationChain),
          gasValue: Cl.uint(gasValue),
          tokenAddress: Cl.address(tokenAddress),
          tokenId,
          tokenManagerAddress: Cl.address(tokenAddress),
          caller: deployer,
        }).result,
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
          token: Cl.address(tokenAddress) as ContractPrincipalCV,
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeOk(Cl.bufferFromHex("0x"));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      const senderFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: sender,
      });
      expect(recipientFinalBalance).toBe(
        recipientInitialBalance + BigInt(amount),
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });
  });

  describe("Send Token With Data", () => {
    it("Should revert on an interchain transfer if service is paused", () => {
      const amount = 100;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.native-interchain-token`;

      setPaused({ paused: true });

      expect(
        interchainTransfer({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromAscii(destinationAddress),
          destinationChain: Cl.stringAscii(destinationChain),
          gasValue: Cl.uint(gasValue),
          tokenAddress: Cl.address(tokenAddress),
          tokenId,
          tokenManagerAddress: Cl.address(tokenAddress),
          caller: deployer,
          metadata: {
            data: Cl.bufferFromAscii("some data"),
            version: Cl.uint(MetadataVersion.ContractCall),
          },
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });

    it(`Should initiate an interchain token transfer via the interchainTransfer standard contract call & express call lockUnlock`, () => {
      {
        setupTokenManager({});
        deployTokenManager({
          salt,
        });
        enableTokenManager({
          proofSigners,
          tokenId,
        });

        const amount = 100;
        const destinationAddress = "some eth address";
        const destinationChain = "ethereum";
        const gasValue = 100;
        const tokenAddress = `${deployer}.sample-sip-010`;
        const managerAddress = `${deployer}.token-manager`;
        const transferTx = interchainTransfer({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromAscii(destinationAddress),
          destinationChain: Cl.stringAscii(destinationChain),
          gasValue: Cl.uint(gasValue),
          tokenAddress: Cl.address(tokenAddress),
          tokenId,
          tokenManagerAddress: Cl.address(managerAddress),
          caller: deployer,
          metadata: {
            data: Cl.bufferFromAscii("some data"),
            version: Cl.uint(MetadataVersion.ContractCall),
          },
        });
        expect(transferTx.result).toBeOk(Cl.bool(true));
        const [
          _ftTransfer,
          itsTransferAnnouncement,
          _gasTransfer,
          _nativeGasPaidForContractCall,
          _gatewayContractCall,
        ] = transferTx.events;
        expect(
          (itsTransferAnnouncement.data.value as TupleCV<{ data: BufferCV }>)
            .data.data,
        ).toBeBuff(keccak256(Buffer.from("some data")));
      }
    });
    it(`Should initiate an interchain token transfer via the interchainTransfer standard contract call & express call mintBurn`, () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.native-interchain-token`;

      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      expect(
        mintNIT({
          amount,
          minter: deployer,
        }).result,
      ).toBeOk(Cl.bool(true));
      const transferTx = interchainTransfer({
        amount: Cl.uint(amount),
        destinationAddress: Cl.bufferFromAscii(destinationAddress),
        destinationChain: Cl.stringAscii(destinationChain),
        gasValue: Cl.uint(gasValue),
        tokenAddress: Cl.address(tokenAddress),
        tokenId,
        tokenManagerAddress: Cl.address(tokenAddress),
        caller: deployer,
        metadata: {
          data: Cl.bufferFromAscii("some data"),
          version: Cl.uint(MetadataVersion.ContractCall),
        },
      });
      expect(transferTx.result).toBeOk(Cl.bool(true));
      const [
        _ftTransfer,
        itsTransferAnnouncement,
        _gasTransfer,
        _nativeGasPaidForContractCall,
        _gatewayContractCall,
      ] = transferTx.events;
      expect(
        (itsTransferAnnouncement.data.value as TupleCV<{ data: BufferCV }>).data
          .data,
      ).toBeBuff(keccak256(Buffer.from("some data")));
    });

    it("Should revert on callContractWithInterchainToken function on the service if amount is 0", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = Cl.uint(0);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.native-interchain-token`,
      ) as ContractPrincipalCV;

      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      const callContractTx = callContractWithInterchainToken({
        amount,
        caller: deployer,
        destinationAddress,
        destinationChain,
        gasValue,
        tokenAddress,
        tokenId,
        tokenManagerAddress: tokenAddress,
        metadata: {
          data: Cl.bufferFromHex("0x"),
          version: Cl.uint(MetadataVersion.ContractCall),
        },
      });
      expect(callContractTx.result).toBeErr(ITS_ERROR_CODES["ERR-ZERO-AMOUNT"]);
    });

    it(`Should be able to initiate an interchain token transfer via the interchainTransfer function on the service when the service is approved as well [lockUnlock]`, () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const amount = 100;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${deployer}.token-manager`;
      const transferTx = interchainTransfer({
        amount: Cl.uint(amount),
        destinationAddress: Cl.bufferFromAscii(destinationAddress),
        destinationChain: Cl.stringAscii(destinationChain),
        gasValue: Cl.uint(gasValue),
        tokenAddress: Cl.address(tokenAddress),
        tokenId,
        tokenManagerAddress: Cl.address(managerAddress),
        caller: deployer,
        metadata: {
          data: Cl.bufferFromAscii("some data"),
          version: Cl.uint(MetadataVersion.ContractCall),
        },
      });
      expect(transferTx.result).toBeOk(Cl.bool(true));
    });

    describe("callContractWithInterchainToken", () => {
      const lockUnlockSalt = randomBytes(32);
      const lockUnlockTokenId = getTokenId(lockUnlockSalt).result as BufferCV;
      const mintBurnSalt = randomBytes(32);
      const mintBurnTokenId = getTokenId(mintBurnSalt).result as BufferCV;
      const tokenId = {
        mintBurn: mintBurnTokenId,
        lockUnlock: lockUnlockTokenId,
      };

      const amount = Cl.uint(100);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = {
        mintBurn: Cl.address(
          `${deployer}.native-interchain-token`,
        ) as ContractPrincipalCV,
        lockUnlock: Cl.address(
          `${deployer}.sample-sip-010`,
        ) as ContractPrincipalCV,
      };
      const tokenManager = {
        mintBurn: Cl.address(
          `${deployer}.native-interchain-token`,
        ) as ContractPrincipalCV,
        lockUnlock: Cl.address(
          `${deployer}.token-manager`,
        ) as ContractPrincipalCV,
      };
      beforeEach(() => {
        setupTokenManager({});
        deployTokenManager({
          salt: lockUnlockSalt,
        });
        enableTokenManager({
          proofSigners,
          tokenId: tokenId.lockUnlock,
        });
        setupNIT({ tokenId: tokenId.mintBurn, minter: deployer });
        const deployTx = deployInterchainToken({
          salt: mintBurnSalt,
          minter: Cl.address(deployer),
          gasValue: 1000,
        });
        expect(deployTx.result).toBeOk(Cl.bool(true));
        expect(
          executeDeployInterchainToken({
            messageId: "approved-native-interchain-token-deployment-message",
            payload: Cl.serialize(
              approveDeployNativeInterchainToken({
                proofSigners,
                tokenId: mintBurnTokenId,
                minter: deployer,
              }).payload,
            ),
            sourceAddress: "interchain-token-service",
            sourceChain: "stacks",
            tokenAddress: `${deployer}.native-interchain-token`,
            gasValue: 1000,
          }).result,
        ).toBeOk(Cl.bool(true));
        mintNIT({
          amount: 100000,
          minter: deployer,
        });
      });
      for (const type of [
        "lockUnlock",
        "mintBurn",
      ] as (keyof typeof tokenAddress)[]) {
        it(`Should be able to initiate an interchain token transfer via the callContractWithInterchainToken function on the service [${type}]`, () => {
          const callContractTx = callContractWithInterchainToken({
            amount: amount,
            destinationAddress: destinationAddress,
            destinationChain: destinationChain,
            gasValue: gasValue,
            tokenAddress: tokenAddress[type],
            tokenId: tokenId[type],
            tokenManagerAddress: tokenManager[type],
            caller: deployer,
            metadata: {
              data: Cl.bufferFromAscii("some data"),
              version: Cl.uint(MetadataVersion.ContractCall),
            },
          });
          expect(callContractTx.result).toBeOk(Cl.bool(true));
        });
      }
    });

    it("Should revert on callContractWithInterchainToken if data is empty", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });
      const amount = Cl.uint(0);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`,
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${deployer}.token-manager`,
      ) as ContractPrincipalCV;
      const callContractTx = callContractWithInterchainToken({
        amount: amount,
        destinationAddress: destinationAddress,
        destinationChain: destinationChain,
        gasValue: gasValue,
        tokenAddress: tokenAddress,
        tokenId: tokenId,
        tokenManagerAddress: tokenManager,
        caller: deployer,
        metadata: {
          data: Cl.bufferFromAscii("some data"),
          version: Cl.uint(MetadataVersion.ContractCall),
        },
      });
      expect(callContractTx.result).toBeErr(ITS_ERROR_CODES["ERR-ZERO-AMOUNT"]);
    });

    it("Should revert on callContractWithInterchainToken function when service is paused", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });
      setPaused({ paused: true });
      const amount = Cl.uint(0);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`,
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${deployer}.token-manager`,
      ) as ContractPrincipalCV;
      const callContractTx = callContractWithInterchainToken({
        amount: amount,
        destinationAddress: destinationAddress,
        destinationChain: destinationChain,
        gasValue: gasValue,
        tokenAddress: tokenAddress,
        tokenId: tokenId,
        tokenManagerAddress: tokenManager,
        caller: deployer,
        metadata: {
          data: Cl.bufferFromAscii("some data"),
          version: Cl.uint(MetadataVersion.ContractCall),
        },
      });
      expect(callContractTx.result).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should revert on interchainTransfer function when service is paused", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });
      setPaused({ paused: true });
      const amount = Cl.uint(100);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`,
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${deployer}.token-manager`,
      ) as ContractPrincipalCV;
      const transferTx = interchainTransfer({
        amount: amount,
        destinationAddress: destinationAddress,
        destinationChain: destinationChain,
        gasValue: gasValue,
        tokenAddress: tokenAddress,
        tokenId: tokenId,
        tokenManagerAddress: tokenManager,
        caller: deployer,
        metadata: {
          data: Cl.bufferFromAscii("some data"),
          version: Cl.uint(MetadataVersion.ContractCall),
        },
      });
      expect(transferTx.result).toBeErr(ITS_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should revert on interchainTransfer function with invalid metadata version", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const amount = Cl.uint(100);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`,
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${deployer}.token-manager`,
      ) as ContractPrincipalCV;
      const transferTx = interchainTransfer({
        amount: amount,
        destinationAddress: destinationAddress,
        destinationChain: destinationChain,
        gasValue: gasValue,
        tokenAddress: tokenAddress,
        tokenId: tokenId,
        tokenManagerAddress: tokenManager,
        caller: deployer,
        metadata: {
          data: Cl.bufferFromAscii("some data"),
          version: Cl.uint(2),
        },
      });
      expect(transferTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-INVALID-METADATA-VERSION"],
      );
    });

    it("Should revert on callContractWithInterchainToken when destination chain is untrusted chain", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });
      const amount = Cl.uint(100);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("oneCoin");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`,
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${deployer}.token-manager`,
      ) as ContractPrincipalCV;
      const callContractTx = callContractWithInterchainToken({
        amount: amount,
        destinationAddress: destinationAddress,
        destinationChain: destinationChain,
        gasValue: gasValue,
        tokenAddress: tokenAddress,
        tokenId: tokenId,
        tokenManagerAddress: tokenManager,
        caller: deployer,
        metadata: {
          data: Cl.bufferFromAscii("some data"),
          version: Cl.uint(MetadataVersion.ContractCall),
        },
      });
      expect(callContractTx.result).toBeErr(
        ITS_ERROR_CODES["ERR-UNTRUSTED-CHAIN"],
      );
    });
  });

  describe("Receive Remote Token with Data", () => {
    it("Should be able to receive lock/unlock token", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${deployer}.token-manager`;
      const recipientInitialBalance = getSip010Balance({
        address: recipient,
        contractAddress: tokenAddress,
      });

      const senderInitialBalance = getSip010Balance({
        address: sender,
        contractAddress: tokenAddress,
      });

      expect(
        interchainTransfer({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromAscii(destinationAddress),
          destinationChain: Cl.stringAscii(destinationChain),
          gasValue: Cl.uint(gasValue),
          tokenAddress: Cl.address(tokenAddress),
          tokenId,
          tokenManagerAddress: Cl.address(managerAddress),
          caller: deployer,
        }).result,
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.contractPrincipal(deployer, "token-manager"),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeOk(Cl.bufferFromHex("0x"));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      const senderFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: sender,
      });
      expect(recipientFinalBalance).toBe(
        recipientInitialBalance + BigInt(amount),
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });

    it("Should be able to receive lock/unlock token with empty data and not call destination contract", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${deployer}.token-manager`;
      const recipientInitialBalance = getSip010Balance({
        address: recipient,
        contractAddress: tokenAddress,
      });

      const senderInitialBalance = getSip010Balance({
        address: sender,
        contractAddress: tokenAddress,
      });

      expect(
        interchainTransfer({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromAscii(destinationAddress),
          destinationChain: Cl.stringAscii(destinationChain),
          gasValue: Cl.uint(gasValue),
          tokenAddress: Cl.address(tokenAddress),
          tokenId,
          tokenManagerAddress: Cl.address(managerAddress),
          caller: deployer,
        }).result,
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      const receiveTokenTx = executeReceiveInterchainToken({
        messageId: "approved-interchain-transfer-message",
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        tokenManager: Cl.contractPrincipal(deployer, "token-manager"),
        token: Cl.contractPrincipal(deployer, "sample-sip-010"),
        payload: Cl.buffer(Cl.serialize(payload)),
        destinationContract: Cl.contractPrincipal(deployer, "hello-world"),
      });
      expect(receiveTokenTx.result).toBeOk(Cl.bufferFromHex("0x"));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      const senderFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: sender,
      });
      expect(recipientFinalBalance).toBe(
        recipientInitialBalance + BigInt(amount),
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });

    it("Should be able to receive mint/burn token", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const tokenAddress = `${deployer}.native-interchain-token`;
      const recipientInitialBalance = getSip010Balance({
        address: recipient,
        contractAddress: tokenAddress,
      });

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
          token: Cl.address(tokenAddress) as ContractPrincipalCV,
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeOk(Cl.bufferFromHex("0x"));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      expect(recipientFinalBalance).toBe(
        BigInt(recipientInitialBalance) + BigInt(amount),
      );
    });

    it("Should revert if execute with interchain token fails", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = deployer;
      const recipient = `${deployer}.failed-interchain-executable`;
      const tokenAddress = `${deployer}.native-interchain-token`;
      const recipientInitialBalance = getSip010Balance({
        address: recipient,
        contractAddress: tokenAddress,
      });

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0xdeadbeef"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
          token: Cl.address(tokenAddress) as ContractPrincipalCV,
          payload: Cl.buffer(Cl.serialize(payload)),
          destinationContract: Cl.address(recipient) as ContractPrincipalCV,
        }).result,
      ).toBeErr(Cl.uint(8051));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      expect(recipientFinalBalance).toBe(BigInt(recipientInitialBalance));
    });

    it("Should revert with UntrustedChain when the message type is RECEIVE_FROM_HUB and untrusted chain", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const tokenAddress = `${deployer}.native-interchain-token`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: "oneCoin",
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
          token: Cl.address(tokenAddress) as ContractPrincipalCV,
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });

    it("Should revert with UntrustedChain when the message type is RECEIVE_FROM_HUB and untrusted original source chain", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const tokenAddress = `${deployer}.native-interchain-token`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
        sourceChain: "oneCoin",
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
          token: Cl.address(tokenAddress) as ContractPrincipalCV,
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });

    it("Should revert with InvalidPayload when the message type is RECEIVE_FROM_HUB and has invalid inner payload.", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      const tokenAddress = `${deployer}.native-interchain-token`;

      const payload = Cl.tuple({
        type: Cl.stringAscii("invalid"),
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
          token: Cl.address(tokenAddress) as ContractPrincipalCV,
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-INVALID-PAYLOAD"]);
    });

    it("Should revert with UntrustedChain when receiving a direct message from the ITS Hub. Not supported yet", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const tokenAddress = `${deployer}.native-interchain-token`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
        sourceChain: TRUSTED_CHAIN,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
          token: Cl.address(tokenAddress) as ContractPrincipalCV,
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result,
      ).toBeErr(ITS_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });
  });

  describe("Flow Limits", () => {
    function transferFromDeployer({
      amount,
      tokenAddress,
      tokenManagerAddress,
    }: {
      amount: number;
      tokenAddress: string;
      tokenManagerAddress: string;
    }) {
      return interchainTransfer({
        amount: Cl.uint(amount),
        destinationAddress: Cl.bufferFromAscii("destinationAddress"),
        destinationChain: Cl.stringAscii("ethereum"),
        gasValue: Cl.uint(100),
        tokenAddress: Cl.contractPrincipal(deployer, tokenAddress),
        tokenId: tokenId,
        tokenManagerAddress: Cl.contractPrincipal(
          deployer,
          tokenManagerAddress,
        ),
        caller: deployer,
      });
    }
    function sendLockUnlock(amount: number) {
      return transferFromDeployer({
        amount,
        tokenAddress: "sample-sip-010",
        tokenManagerAddress: "token-manager",
      });
    }
    function sendMintBurn(amount: number) {
      return transferFromDeployer({
        amount,
        tokenAddress: "native-interchain-token",
        tokenManagerAddress: "native-interchain-token",
      });
    }
    function receiveMintBurnToken(amount: number) {
      const messageId = Buffer.from(randomBytes(32)).toString("hex");
      const sender = deployer;
      const recipient = address1;
      const tokenAddress = `${deployer}.native-interchain-token`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
        gasValue: 1000,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
        messageId,
      });
      return executeReceiveInterchainToken({
        messageId: messageId,
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        tokenManager: Cl.address(tokenAddress) as ContractPrincipalCV,
        token: Cl.address(tokenAddress) as ContractPrincipalCV,
        payload: Cl.buffer(Cl.serialize(payload)),
      });
    }

    it("Should be able to send token only if it does not trigger the mint limit", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      enableTokenManager({
        proofSigners,
        tokenId,
      });
      const setFlowTx = setFlowLimit({
        tokenId,
        tokenManagerAddress: Cl.contractPrincipal(deployer, "token-manager"),
        limit: Cl.uint(500),
      });

      // test that the transfer limit is not reached
      expect(setFlowTx.result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(501).result).toBeErr(
        TOKEN_MANAGER_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
      expect(sendLockUnlock(200).result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(200).result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(100).result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(1).result).toBeErr(
        TOKEN_MANAGER_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
    });
    it("Should be able to send token only if it does not trigger the mint limit", () => {
      // setup token manager and set a transfer limit through the ITS

      // setup NIT and set a mint limit through the ITS
      setupNIT({
        tokenId,
        minter: deployer,
      });
      deployInterchainToken({
        salt,
        gasValue: 1000,
        minter: Cl.address(deployer),
      });

      const { payload } = approveDeployNativeInterchainToken({
        proofSigners,
        tokenId,
        minter: deployer,
      });

      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(payload),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));

      expect(
        mintNIT({
          amount: 1000_000,
          minter: deployer,
        }).result,
      ).toBeOk(Cl.bool(true));
      expect(
        setFlowLimit({
          tokenId,
          limit: Cl.uint(500),
          tokenManagerAddress: Cl.contractPrincipal(
            deployer,
            "native-interchain-token",
          ),
        }).result,
      ).toBeOk(Cl.bool(true));
      // test that the transfer limit is not reached
      expect(sendMintBurn(501).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
      expect(sendMintBurn(101).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
      expect(sendMintBurn(100).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(1).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
    });
    it("Should be able to receive token only if it does not trigger the mint limit", () => {
      setupNIT({ tokenId, minter: deployer });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(deployer),
        gasValue: 1000,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload,
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${deployer}.native-interchain-token`,
          gasValue: 1000,
        }).result,
      ).toBeOk(Cl.bool(true));
      mintNIT({
        amount: 1000,
        minter: deployer,
      });
      setFlowLimit({
        tokenId,
        tokenManagerAddress: Cl.contractPrincipal(
          deployer,
          "native-interchain-token",
        ),
        limit: Cl.uint(500),
      });
      expect(receiveMintBurnToken(501).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
      expect(receiveMintBurnToken(100).result).toBeOk(Cl.bufferFromHex("0x"));
      expect(receiveMintBurnToken(200).result).toBeOk(Cl.bufferFromHex("0x"));
      expect(receiveMintBurnToken(200).result).toBeOk(Cl.bufferFromHex("0x"));
      expect(receiveMintBurnToken(1).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
      expect(sendMintBurn(501).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
      expect(sendMintBurn(100).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(500).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(1).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"],
      );
    });

    describe("Should be able to set flow limits for each token manager", () => {
      it("lock unlock", () => {
        setupTokenManager({});
        deployTokenManager({ salt });
        enableTokenManager({
          proofSigners,
          tokenId,
        });

        setFlowLimit({
          tokenId,
          tokenManagerAddress: Cl.contractPrincipal(deployer, "token-manager"),
          limit: Cl.uint(5),
        });
        expect(getFlowLimit("token-manager").result).toBeOk(Cl.uint(5));
      });
      it("mint burn", () => {
        setupNIT({ tokenId, minter: deployer });
        const deployTx = deployInterchainToken({
          salt,
          minter: Cl.address(deployer),
          gasValue: 1000,
        });
        expect(deployTx.result).toBeOk(Cl.bool(true));
        expect(
          executeDeployInterchainToken({
            messageId: "approved-native-interchain-token-deployment-message",
            payload: Cl.serialize(
              approveDeployNativeInterchainToken({
                proofSigners,
                tokenId,
                minter: deployer,
              }).payload,
            ),
            sourceAddress: "interchain-token-service",
            sourceChain: "stacks",
            tokenAddress: `${deployer}.native-interchain-token`,
            gasValue: 1000,
          }).result,
        ).toBeOk(Cl.bool(true));

        expect(
          setFlowLimit({
            tokenId,
            tokenManagerAddress: Cl.contractPrincipal(
              deployer,
              "native-interchain-token",
            ),
            limit: Cl.uint(5),
          }).result,
        ).toBeOk(Cl.bool(true));
        expect(getFlowLimit("native-interchain-token").result).toBeOk(
          Cl.uint(5),
        );
      });
    });
  });

  describe("Flow Limiters", () => {
    describe("Should be able to add a flow limiter", () => {
      function runCurrentTests(contractName: string) {
        expect(
          addFlowLimiter({
            contractName,
            limiterAddress: address2,
            operator: address1,
          }).result,
        ).toBeOk(Cl.bool(true));
        expect(
          isFlowLimiter({
            contractName,
            limiterAddress: address2,
          }).result,
        ).toBeOk(Cl.bool(true));

        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeOk(
          Cl.bool(true),
        );
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(contractName);
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        setupNIT({ tokenId, minter: deployer, operator: address1 });
        runCurrentTests(contractName);
      });
    });

    describe("Should be able to remove a flow limiter", () => {
      function runCurrentTests(contractName: string) {
        expect(
          addFlowLimiter({
            contractName,
            limiterAddress: address2,
            operator: address1,
          }).result,
        ).toBeOk(Cl.bool(true));
        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeOk(
          Cl.bool(true),
        );
        expect(
          removeFlowLimiter({
            contractName,
            limiterAddress: address2,
            operator: address1,
          }).result,
        ).toBeOk(Cl.bool(true));
        expect(
          isFlowLimiter({
            contractName,
            limiterAddress: address2,
          }).result,
        ).toBeOk(Cl.bool(false));

        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeErr(
          NIT_ERRORS["ERR-NOT-AUTHORIZED"],
        );
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(contractName);
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        setupNIT({ tokenId, minter: deployer, operator: address1 });
        runCurrentTests(contractName);
      });
    });

    describe("Should revert if trying to add a flow limiter as not the operator", () => {
      function runCurrentTests(contractName: string) {
        expect(
          addFlowLimiter({
            contractName,
            limiterAddress: address2,
            operator: address2,
          }).result,
        ).toBeErr(NIT_ERRORS["ERR-NOT-AUTHORIZED"]);

        expect(
          isFlowLimiter({
            contractName,
            limiterAddress: address2,
          }).result,
        ).toBeOk(Cl.bool(false));

        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeErr(
          NIT_ERRORS["ERR-NOT-AUTHORIZED"],
        );
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(contractName);
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        setupNIT({ tokenId, minter: deployer });
        runCurrentTests(contractName);
      });
    });

    describe("Should be able to transfer the operator", () => {
      function runCurrentTests(
        contractName: string,
        operator = address1,
        ERROR_CODE = NIT_ERRORS["ERR-ONLY-OPERATOR"],
      ) {
        expect(isOperator({ contractName, operator: address2 }).result).toBeOk(
          Cl.bool(false),
        );
        expect(isOperator({ contractName, operator: operator }).result).toBeOk(
          Cl.bool(true),
        );
        expect(
          transferTokenOperatorShip({
            contractName,
            operator: operator,
            newOperator: address2,
          }).result,
        ).toBeOk(Cl.bool(true));
        expect(isOperator({ contractName, operator: address2 }).result).toBeOk(
          Cl.bool(true),
        );
        expect(isOperator({ contractName, operator: operator }).result).toBeOk(
          Cl.bool(false),
        );

        expect(
          transferTokenOperatorShip({
            contractName,
            operator: operator,
            newOperator: address2,
          }).result,
        ).toBeErr(ERROR_CODE);
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(contractName);
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        setupNIT({ tokenId, minter: deployer, operator: address1 });
        runCurrentTests(contractName);
      });

      it("its", () => {
        const implContractName = "interchain-token-service-impl";
        const operator = deployer;

        expect(
          isOperator({ contractName: implContractName, operator: address2 })
            .result,
        ).toBeOk(Cl.bool(false));
        expect(
          isOperator({ contractName: implContractName, operator }).result,
        ).toBeOk(Cl.bool(true));
        expect(
          transferITSOperatorShip({
            operator,
            newOperator: address2,
          }).result,
        ).toBeOk(Cl.bool(true));
        expect(
          isOperator({ contractName: implContractName, operator: address2 })
            .result,
        ).toBeOk(Cl.bool(true));
        expect(
          isOperator({ contractName: implContractName, operator: operator })
            .result,
        ).toBeOk(Cl.bool(false));

        expect(
          transferITSOperatorShip({
            operator: operator,
            newOperator: address2,
          }).result,
        ).toBeErr(ITS_ERROR_CODES["ERR-ONLY-OPERATOR"]);
      });
    });
  });
});
