import {
  BufferCV,
  Cl,
  ContractPrincipalCV,
  randomBytes,
  TupleCV,
} from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ITS_HUB_ROUTING_IDENTIFIER,
  ITS_IMPL_ERROR_CODES,
  ITS_PROXY_ERROR_CODES,
  MessageType,
  MetadataVersion,
  NIT_ERRORS,
  TOKEN_MANAGER_ERRORS,
  TRUSTED_ADDRESS,
  TRUSTED_CHAIN,
} from "./constants";
import {
  addFlowLimiter,
  approveDeployNativeInterchainToken,
  approveReceiveInterchainTransfer,
  approveRemoteInterchainToken,
  buildFtTransferEvent,
  buildIncomingInterchainTransferPayload,
  buildOutgoingGMPMessage,
  buildSTXTransferEvent,
  callContractWithInterchainToken,
  deployInterchainToken,
  deployRemoteInterchainToken,
  deployTokenManager,
  executeDeployInterchainToken,
  executeReceiveInterchainToken,
  getFlowLimit,
  getHelloWorldValue,
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
  transferITSOwnership,
  transferSip010,
  transferTokenOperatorShip,
} from "./its-utils";
import { gasImplContract, gatewayImplCV, getSigners } from "./util";
import { getNITMockCv, getTokenManagerMockCv, nitMockParams, tmMockParams } from "./verification-util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

const proofSigners = getSigners(0, 10, 1, 10, "1");

describe("Interchain Token Service", () => {
  const salt = randomBytes(32);
  const tokenId = getTokenId(salt).result as BufferCV;

  const evilImpl = Cl.address(`${address2}.interchain-token-service-impl`);
  beforeEach(() => {
    const implCode = simnet
      .getContractSource(`interchain-token-service-impl`)!
      .replace(/ \./g, ` '${deployer}.`);
    expect(
      simnet.deployContract(
        "interchain-token-service-impl",
        implCode,
        { clarityVersion: 2 },
        address2
      ).result
    ).toBeBool(true);
    setupService(proofSigners);
  });
  describe("Owner functions", () => {
    it("Should revert if an invalid impl is provided", () => {
      const deployTx = setPaused({
        impl: evilImpl,
        paused: true,
      });

      expect(deployTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );

      const setTrustedAddressTx = simnet.callPublicFn(
        "interchain-token-service",
        "set-trusted-address",
        [
          evilImpl,
          Cl.stringAscii("ethereum"),
          Cl.stringAscii(ITS_HUB_ROUTING_IDENTIFIER),
        ],
        deployer
      );

      expect(setTrustedAddressTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );

      const removeTrustedAddressTx = simnet.callPublicFn(
        "interchain-token-service",
        "remove-trusted-address",
        [evilImpl, Cl.stringAscii("ethereum")],
        deployer
      );

      expect(removeTrustedAddressTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );
    });
    it("Should revert on set pause status when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-paused",
          [itsImpl, Cl.bool(true)],
          address1
        ).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
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
          address1
        ).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should only be allowed to set 'hub' as the trusted address if not the ITS hub chain", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [itsImpl, Cl.stringAscii("ethereum"), Cl.stringAscii("any other")],
          deployer
        ).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-INVALID-DESTINATION-ADDRESS"]);

      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [
            itsImpl,
            Cl.stringAscii("ethereum"),
            Cl.stringAscii(ITS_HUB_ROUTING_IDENTIFIER),
          ],
          deployer
        ).result
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
          deployer
        ).result
      ).toBeOk(Cl.bool(true));
    });

    it("Should revert on remove trusted address when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [itsImpl, Cl.stringAscii("ethereum")],
          address1
        ).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
    });

    it("Should remove trusted address", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [itsImpl, Cl.stringAscii("ethereum")],
          deployer
        ).result
      ).toBeOk(Cl.bool(true));
    });
  });

  describe("Deploy and Register Interchain Token", () => {
    it("Should revert if an invalid impl is provided", () => {
      const deployTokenManagerTx = deployTokenManager({
        impl: evilImpl,
        salt,
      });

      expect(deployTokenManagerTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );

      const deployInterchainTokenTx = deployInterchainToken({
        impl: evilImpl,
        salt,
      });

      expect(deployInterchainTokenTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );

      expect(
        executeDeployInterchainToken({
          messageId: "approved-native-interchain-token-deployment-message",
          payload: Cl.serialize(
            approveDeployNativeInterchainToken({
              proofSigners,
              tokenId,
              minter: deployer,
            }).payload
          ),
          sourceAddress: "interchain-token-service",
          sourceChain: "stacks",
          tokenAddress: `${address1}.${nitMockParams.name}`,
          impl: evilImpl,
        }).result
      ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]);
    });
    it("Should register an existing token with its manager", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });

      const deployTx = deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
      expect(deployTx.events[0].event).toBe("print_event");
      expect(Cl.deserialize(deployTx.events[0].data.raw_value!)).toBeTuple({
        type: Cl.stringAscii("interchain-token-id-claimed"),
        "token-id": tokenId,
        deployer: Cl.standardPrincipal(address1),
        salt: Cl.buffer(salt),
      });
    });

    it("Should register a native interchain token", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        contract: `${address1}.${nitMockParams.name}`,
        minter: address1,
        operator: address1,
        sender: address1,
      });

      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
        token: Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV,
      });

      expect(deployTx.result).toBeOk(Cl.bool(true));
    });

    it("Should revert when registering an interchain token when service is paused", () => {
      setPaused({ paused: true });
      expect(deployInterchainToken({ salt }).result).toBeErr(
        ITS_IMPL_ERROR_CODES["ERR-PAUSED"]
      );
    });

    it("Should revert when deploying an interchain token twice", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        contract: `${address1}.${nitMockParams.name}`,
        minter: address1,
        operator: address1,
        sender: address1,
      });
      deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
        token: Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV,
      });
      const secondDeployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
        token: Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV,
      });

      expect(secondDeployTx.result).toBeErr(
        ITS_IMPL_ERROR_CODES["ERR-TOKEN-EXISTS"]
      );

      const thirdDeployTx = deployInterchainToken({
        salt: randomBytes(32),
        minter: Cl.address(address1),
        verificationParams,
        token: Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV,
      });

      expect(thirdDeployTx.result).toBeErr(
        ITS_IMPL_ERROR_CODES["ERR-TOKEN-EXISTS"]
      );
    });
  });

  describe("Deploy and Register remote Interchain Token", () => {
    // const tokenId = getTokenId(salt).result as BufferCV;
    it("Should initialize a remote interchain token deployment", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });

      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
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
          impl: evilImpl,
        }).result
      ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]);
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
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });

      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
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
      ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });

    it("Should revert on remote interchain token deployment if paused", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
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
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Receive Remote Interchain Token Deployment", () => {
    const tokenId = getTokenId(salt).result as BufferCV;

    it("Should revert if an invalid impl is provided", () => {
      expect(
        executeDeployInterchainToken({
          messageId: "approved-interchain-token-deployment-message",
          payload: Buffer.from([0]),
          sourceAddress: TRUSTED_ADDRESS,
          sourceChain: TRUSTED_CHAIN,
          tokenAddress: `${deployer}.sample-sip-010`,
          impl: evilImpl,
        }).result
      ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]);
    });
    it("Should revert on receiving a remote interchain token deployment if not approved by the gateway", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        contract: `${address1}.${nitMockParams.name}`,
        tokenId,
        sender: address1,
      });
      expect(
        executeDeployInterchainToken({
          messageId: "unapproved-message",
          payload: Cl.serialize(
            Cl.tuple({
              type: Cl.uint(MessageType.DEPLOY_INTERCHAIN_TOKEN),
              "source-chain": Cl.stringAscii("ethereum"),
              "token-id": tokenId,
              name: Cl.stringAscii("Nitter"),
              symbol: Cl.stringAscii("NIT"),
              decimals: Cl.uint(6),
              "minter-bytes": Cl.bufferFromHex(""),
              verificationParams,
            })
          ),
          sourceAddress: TRUSTED_ADDRESS,
          sourceChain: TRUSTED_CHAIN,
          tokenAddress: `${address1}.${nitMockParams.name}`,
        }).result
      ).toBeErr(
        // ERR-MESSAGE-NOT-FOUND
        Cl.uint(50004)
      );
    });

    it("Should be able to receive a remote interchain token deployment with a mint/burn token manager with empty minter and operator", () => {
      const { payload } = approveRemoteInterchainToken({
        proofSigners,
        tokenId,
      });
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        contract: `${address1}.${nitMockParams.name}`,
        sender: address1,
      });
      expect(
        executeDeployInterchainToken({
          messageId: "approved-interchain-token-deployment-message",
          payload: Cl.serialize(payload),
          sourceAddress: TRUSTED_ADDRESS,
          sourceChain: TRUSTED_CHAIN,
          tokenAddress: `${address1}.${nitMockParams.name}`,
          verificationParams,
        }).result
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-UNSUPPORTED-TOKEN-TYPE"]);
    });

    it("Should revert when deploying a custom token manager twice", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });

      const secondDeployTx = deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });

      expect(secondDeployTx.result).toBeErr(
        ITS_IMPL_ERROR_CODES["ERR-TOKEN-EXISTS"]
      );

      const thirdDeployTx = deployTokenManager({
        salt: randomBytes(32),
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });

      expect(thirdDeployTx.result).toBeErr(
        ITS_IMPL_ERROR_CODES["ERR-TOKEN-EXISTS"]
      );
    });

    it("Should revert when deploying a custom token manager if paused", () => {
      setupTokenManager({});
      expect(setPaused({ paused: true }).result).toBeOk(Cl.bool(true));
      expect(
        deployTokenManager({
          salt,
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Send Token", () => {
    it("Should revert if an invalid impl is provided", () => {
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
        impl: evilImpl,
      });
      expect(transferTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );
    });
    it("Should be able to initiate an interchain token transfer for lockUnlock with a normal SIP-010 token", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });
      const amount = 1000;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${address1}.${tmMockParams.name}`;
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
        senderFinalBalance
      );

      expect(ftTransfer).toStrictEqual(
        buildFtTransferEvent({
          amount,
          recipient: managerAddress,
          sender: deployer,
          tokenName: "itscoin",
          tokenAddress,
        })
      );
      expect(gasTransfer).toStrictEqual(
        buildSTXTransferEvent({
          amount: gasValue,
          recipient: `${deployer}.gas-impl`,
          sender: deployer,
        })
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
                })
              )
            ),
          }),
        })
      );
    });

    // it("Should revert on initiating an interchain token transfer for lockUnlockFee with reentrant token", () => {});

    it("Should revert on initiate interchain token transfer with zero amount", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });
      expect(
        interchainTransfer({
          amount: Cl.uint(0),
          destinationAddress: Cl.bufferFromHex("0x00"),
          destinationChain: Cl.stringAscii("ethereum"),
          gasValue: Cl.uint(100),
          tokenAddress: Cl.contractPrincipal(deployer, "sample-sip-010"),
          tokenId,
          tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
          caller: deployer,
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-ZERO-AMOUNT"]);
    });

    it("Should revert on initiate interchain token transfer when service is paused", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Execute checks", () => {
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-REMOTE-SERVICE"]);
    });

    it("Should revert on execute receive interchain token if remote address validation fails", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });
      expect(
        executeReceiveInterchainToken({
          messageId: "interchain-transfer-received",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: "untrusted address",
          tokenManager: Cl.contractPrincipal(address1, tmMockParams.name),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(3),
                "token-id": tokenId,
                "source-chain": Cl.stringAscii("ethereum"),
                "source-address": Cl.buffer(Cl.serialize(Cl.address(deployer))),
                "destination-address": Cl.buffer(
                  Cl.serialize(Cl.address(address1))
                ),
                amount: Cl.uint(1000),
                data: Cl.bufferFromHex("0x"),
              })
            )
          ),
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-REMOTE-SERVICE"]);
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should revert on execute receive interchain token if the service is paused", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });
      setPaused({ paused: true });
      expect(
        executeReceiveInterchainToken({
          messageId: "interchain-transfer-received",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.contractPrincipal(address1, tmMockParams.name),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(MessageType.INTERCHAIN_TRANSFER),
                "token-id": tokenId,
                "source-chain": Cl.stringAscii("ethereum"),
                "source-address": Cl.buffer(Cl.serialize(Cl.address(deployer))),
                "destination-address": Cl.buffer(
                  Cl.serialize(Cl.address(address1))
                ),
                amount: Cl.uint(1000),
                data: Cl.bufferFromHex("0x"),
              })
            )
          ),
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });
  });

  describe("Receive Remote Tokens", () => {
    it("Should revert if an invalid impl is provided", () => {
      expect(
        executeReceiveInterchainToken({
          messageId: "approved-interchain-transfer-message",
          sourceChain: TRUSTED_CHAIN,
          sourceAddress: TRUSTED_ADDRESS,
          tokenManager: Cl.contractPrincipal(deployer, "token-manager"),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.bufferFromHex("0x"),
          impl: evilImpl,
        }).result
      ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]);
    });
    it("Should be able to receive lock/unlock token", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${address1}.${tmMockParams.name}`;
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
        }).result
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
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
          tokenManager: Cl.contractPrincipal(address1, tmMockParams.name),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result
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
        recipientInitialBalance + BigInt(amount)
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });

    it("Should be able to receive mint/burn token", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        sender: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = address1;
      const recipient = address2;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${address1}.${nitMockParams.name}`;

      expect(
        mintNIT({
          amount,
          minter: address1,
          NITAddress: `${address1}.${nitMockParams.name}`,
        }).result
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
          caller: address1,
        }).result
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
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
        }).result
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
        recipientInitialBalance + BigInt(amount)
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });
  });

  describe("Send Token With Data", () => {
    it("Should revert if an invalid impl is provided", () => {
      const amount = 100;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.native-interchain-token`;

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
        impl: evilImpl,
      });
      expect(transferTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );

      expect(
        callContractWithInterchainToken({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromAscii(destinationAddress),
          destinationChain: Cl.stringAscii(destinationChain),
          gasValue: Cl.uint(gasValue),
          tokenAddress: Cl.address(tokenAddress),
          caller: deployer,
          metadata: {
            data: Cl.bufferFromAscii("some data"),
            version: Cl.uint(MetadataVersion.ContractCall),
          },
          impl: evilImpl,
          tokenId,
          tokenManagerAddress: Cl.address(tokenAddress),
        }).result
      ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]);
    });
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });

    it(`Should initiate an interchain token transfer via the interchainTransfer standard contract call & express call lockUnlock`, () => {
      {
        const verificationParams = getTokenManagerMockCv();
        setupTokenManager({
          contract: `${address1}.${tmMockParams.name}`,
          sender: address1,
        });
        deployTokenManager({
          salt,
          tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
          verificationParams,
        });

        const amount = 100;
        const destinationAddress = "some eth address";
        const destinationChain = "ethereum";
        const gasValue = 100;
        const tokenAddress = `${deployer}.sample-sip-010`;
        const managerAddress = `${address1}.${tmMockParams.name}`;
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
            .data.data
        ).toBeBuff(keccak256(Buffer.from("some data")));
      }
    });
    it(`Should initiate an interchain token transfer via the interchainTransfer standard contract call & express call mintBurn`, () => {
      getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        contract: `${address1}.${nitMockParams.name}`,
        sender: address1,
        operator: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${address1}.${nitMockParams.name}`;

      expect(
        mintNIT({
          amount,
          minter: address1,
          NITAddress: tokenAddress,
        }).result
      ).toBeOk(Cl.bool(true));
      const transferTx = interchainTransfer({
        amount: Cl.uint(amount),
        destinationAddress: Cl.bufferFromAscii(destinationAddress),
        destinationChain: Cl.stringAscii(destinationChain),
        gasValue: Cl.uint(gasValue),
        tokenAddress: Cl.address(tokenAddress),
        tokenId,
        tokenManagerAddress: Cl.address(tokenAddress),
        caller: address1,
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
          .data
      ).toBeBuff(keccak256(Buffer.from("some data")));
    });

    it("Should revert on callContractWithInterchainToken function on the service if amount is 0", () => {
      getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        contract: `${address1}.${nitMockParams.name}`,
        sender: address1,
        operator: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = Cl.uint(0);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV;

      const callContractTx = callContractWithInterchainToken({
        amount,
        caller: address1,
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
      expect(callContractTx.result).toBeErr(
        ITS_IMPL_ERROR_CODES["ERR-ZERO-AMOUNT"]
      );
    });

    it(`Should be able to initiate an interchain token transfer via the interchainTransfer function on the service when the service is approved as well [lockUnlock]`, () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        verificationParams,
      });

      const amount = 100;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${address1}.${tmMockParams.name}`;
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
        mintBurn: Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV,
        lockUnlock: Cl.address(
          `${deployer}.sample-sip-010`
        ) as ContractPrincipalCV,
      };
      const tokenManager = {
        mintBurn: Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV,
        lockUnlock: Cl.address(`${address1}.${tmMockParams.name}`) as ContractPrincipalCV,
      };
      beforeEach(() => {
        const verificationParams = getTokenManagerMockCv();
        expect(
          setupTokenManager({
            contract: `${address1}.${tmMockParams.name}`,
            sender: address1,
          }).result
        ).toBeOk(Cl.bool(true));
        expect(
          deployTokenManager({
            salt: lockUnlockSalt,
            tokenManagerAddress: Cl.address(
              `${address1}.${tmMockParams.name}`
            ) as ContractPrincipalCV,
            verificationParams,
          }).result
        ).toBeOk(Cl.bool(true));
        const nitVerificationParams = getNITMockCv();
        expect(
          setupNIT({
            tokenId: tokenId.mintBurn,
            minter: address1,
            contract: `${address1}.${nitMockParams.name}`,
            operator: address1,
            sender: address1,
          }).result
        ).toBeOk(Cl.bool(true));
        const deployTx = deployInterchainToken({
          token: Cl.contractPrincipal(address1, nitMockParams.name),
          salt: mintBurnSalt,
          minter: Cl.address(address1),
          verificationParams: nitVerificationParams,
        });
        expect(deployTx.result).toBeOk(Cl.bool(true));

        expect(
          mintNIT({
            amount: 100000,
            minter: address1,
            NITAddress: `${address1}.${nitMockParams.name}`,
          }).result
        ).toBeOk(Cl.bool(true));

        expect(
          transferSip010({
            amount: 100000,
            recipient: address1,
            contractAddress: `${deployer}.sample-sip-010`,
            sender: deployer,
          }).result
        ).toBeOk(Cl.bool(true));
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
            caller: address1,
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
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenAddress: Cl.address(
          `${deployer}.sample-sip-010`
        ) as ContractPrincipalCV,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });
      const amount = Cl.uint(0);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${address1}.${tmMockParams.name}`
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
        ITS_IMPL_ERROR_CODES["ERR-ZERO-AMOUNT"]
      );
    });

    it("Should revert on callContractWithInterchainToken function when service is paused", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      setPaused({ paused: true });
      const amount = Cl.uint(0);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${deployer}.token-manager`
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
      expect(callContractTx.result).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should revert on interchainTransfer function when service is paused", () => {
      setupTokenManager({});
      deployTokenManager({
        salt,
      });
      setPaused({ paused: true });
      const amount = Cl.uint(100);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${deployer}.token-manager`
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
      expect(transferTx.result).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should revert on interchainTransfer function with invalid metadata version", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenAddress: Cl.address(
          `${deployer}.sample-sip-010`
        ) as ContractPrincipalCV,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });

      const amount = Cl.uint(100);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("ethereum");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${address1}.${tmMockParams.name}`
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
        ITS_IMPL_ERROR_CODES["ERR-INVALID-METADATA-VERSION"]
      );
    });

    it("Should revert on callContractWithInterchainToken when destination chain is untrusted chain", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenAddress: Cl.address(
          `${deployer}.sample-sip-010`
        ) as ContractPrincipalCV,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });
      const amount = Cl.uint(100);
      const destinationAddress = Cl.bufferFromAscii("some eth address");
      const destinationChain = Cl.stringAscii("oneCoin");
      const gasValue = Cl.uint(100);
      const tokenAddress = Cl.address(
        `${deployer}.sample-sip-010`
      ) as ContractPrincipalCV;

      const tokenManager = Cl.address(
        `${address1}.${tmMockParams.name}`
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
        ITS_PROXY_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]
      );
    });
  });

  describe("Receive Remote Token with Data", () => {
    it("Should be able to receive lock/unlock token", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenAddress: Cl.address(
          `${deployer}.sample-sip-010`
        ) as ContractPrincipalCV,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });
      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${address1}.${tmMockParams.name}`;
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
        }).result
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
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
          tokenManager: Cl.contractPrincipal(address1, tmMockParams.name),
          token: Cl.contractPrincipal(deployer, "sample-sip-010"),
          payload: Cl.buffer(Cl.serialize(payload)),
        }).result
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
        recipientInitialBalance + BigInt(amount)
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });

    it("Should be able to receive lock/unlock token with empty data and not call destination contract", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenAddress: Cl.address(
          `${deployer}.sample-sip-010`
        ) as ContractPrincipalCV,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });

      const amount = 100;
      const sender = deployer;
      const recipient = address1;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${address1}.${tmMockParams.name}`;
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
        }).result
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      const receiveTokenTx = executeReceiveInterchainToken({
        messageId: "approved-interchain-transfer-message",
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        tokenManager: Cl.contractPrincipal(address1, tmMockParams.name),
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
        recipientInitialBalance + BigInt(amount)
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });

    it("Should be able to receive lock/unlock token with non empty data and call destination contract", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenAddress: Cl.address(
          `${deployer}.sample-sip-010`
        ) as ContractPrincipalCV,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });

      const amount = 100;
      const sender = deployer;
      const recipient = `${deployer}.hello-world`;
      const destinationAddress = "some eth address";
      const destinationChain = "ethereum";
      const gasValue = 100;
      const tokenAddress = `${deployer}.sample-sip-010`;
      const managerAddress = `${address1}.${tmMockParams.name}`;
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
        }).result
      ).toBeOk(Cl.bool(true));

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0xdeadbeef"),
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
      });
      expect(getHelloWorldValue()).toBeTuple({
        "source-chain": Cl.stringAscii(""),
        "message-id": Cl.stringAscii(""),
        "source-address": Cl.stringAscii(""),
        payload: Cl.bufferFromHex("0x00"),
        "source-address-its": Cl.bufferFromHex("0x00"),
      });
      const receiveTokenTx = executeReceiveInterchainToken({
        messageId: "approved-interchain-transfer-message",
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        tokenManager: Cl.contractPrincipal(address1, tmMockParams.name),
        token: Cl.contractPrincipal(deployer, "sample-sip-010"),
        payload: Cl.buffer(Cl.serialize(payload)),
        destinationContract: Cl.contractPrincipal(deployer, "hello-world"),
      });
      expect(receiveTokenTx.result).toBeOk(
        Cl.buffer(
          keccak256(Cl.serialize(Cl.stringAscii("its-execute-success")))
        )
      );

      expect(getHelloWorldValue()).toBeTuple({
        "source-chain": Cl.stringAscii(destinationChain),
        "message-id": Cl.stringAscii("approved-interchain-transfer-message"),
        "source-address": Cl.stringAscii(""),
        payload: Cl.bufferFromHex("0xdeadbeef"),
        "source-address-its": Cl.buffer(Cl.serialize(Cl.address(deployer))),
      });

      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      const senderFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: sender,
      });
      expect(recipientFinalBalance).toBe(
        recipientInitialBalance + BigInt(amount)
      );
      expect(senderFinalBalance).toBe(senderInitialBalance - BigInt(amount));
    });

    it("Should be able to receive mint/burn token", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        sender: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = address1;
      const recipient = address2;
      const tokenAddress = `${address1}.${nitMockParams.name}`;
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
        }).result
      ).toBeOk(Cl.bufferFromHex("0x"));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      expect(recipientFinalBalance).toBe(
        BigInt(recipientInitialBalance) + BigInt(amount)
      );
    });

    it("Should revert if execute with interchain token fails", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        sender: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = address1;
      const recipient = `${deployer}.failed-interchain-executable`;
      simnet.deployContract(
        "failed-interchain-executable",
        `
        ;; title: failed-interchain-executable
        (impl-trait .traits.interchain-token-executable-trait)

        (define-constant ERR-NOT-AUTHORIZED (err u1151))
        (define-public (execute-with-interchain-token
                (source-chain (string-ascii 20))
                (message-id (string-ascii 128))
                (source-address (buff 128))
                (payload (buff 64000))
                (token-id (buff 32))
                (tokenAddress principal)
                (amount uint))
            (begin
                (asserts! (is-eq contract-caller .interchain-token-service-impl) ERR-NOT-AUTHORIZED)
                (try! (if true (err u8051) (ok u0)))
                (ok (keccak256 (unwrap-panic (to-consensus-buff? "its-execute-success"))))))
        `,
        { clarityVersion: 2 },
        deployer
      );
      const tokenAddress = `${address1}.${nitMockParams.name}`;
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
        }).result
      ).toBeErr(Cl.uint(8051));
      const recipientFinalBalance = getSip010Balance({
        contractAddress: tokenAddress,
        address: recipient,
      });

      expect(recipientFinalBalance).toBe(BigInt(recipientInitialBalance));
    });

    it("Should revert with UntrustedChain when the message type is RECEIVE_FROM_HUB and untrusted chain", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        sender: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = address1;
      const recipient = address2;
      const tokenAddress = `${address1}.${nitMockParams.name}`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });

    it("Should revert with UntrustedChain when the message type is RECEIVE_FROM_HUB and untrusted original source chain", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        sender: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = address1;
      const recipient = address2;
      const tokenAddress = `${address1}.${nitMockParams.name}`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });

    it("Should revert with InvalidPayload when the message type is RECEIVE_FROM_HUB and has invalid inner payload.", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        sender: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
      });

      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const tokenAddress = `${address1}.${nitMockParams.name}`;

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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-INVALID-PAYLOAD"]);
    });

    it("Should revert with UntrustedChain when receiving a direct message from the ITS Hub. Not supported yet", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        sender: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
      });

      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
        token: Cl.contractPrincipal(address1, nitMockParams.name),
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      const amount = 100;
      const sender = address1;
      const recipient = address2;
      const tokenAddress = `${address1}.${nitMockParams.name}`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
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
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-UNTRUSTED-CHAIN"]);
    });
  });

  describe("Flow Limits", () => {
    function transferFrom({
      amount,
      tokenAddress,
      tokenManagerAddress,
      from,
    }: {
      amount: number;
      tokenAddress: string;
      tokenManagerAddress: string;
      from: string;
    }) {
      return interchainTransfer({
        amount: Cl.uint(amount),
        destinationAddress: Cl.bufferFromAscii("destinationAddress"),
        destinationChain: Cl.stringAscii("ethereum"),
        gasValue: Cl.uint(100),
        tokenAddress: Cl.address(tokenAddress),
        tokenId: tokenId,
        tokenManagerAddress: Cl.address(tokenManagerAddress),
        caller: from,
      });
    }
    function sendLockUnlock(amount: number) {
      return transferFrom({
        amount,
        tokenAddress: `${deployer}.sample-sip-010`,
        tokenManagerAddress: `${address1}.${tmMockParams.name}`,
        from: deployer,
      });
    }
    function sendMintBurn(amount: number) {
      return transferFrom({
        amount,
        tokenAddress: `${address1}.${nitMockParams.name}`,
        tokenManagerAddress: `${address1}.${nitMockParams.name}`,
        from: address1,
      });
    }
    function receiveMintBurnToken(amount: number) {
      const messageId = Buffer.from(randomBytes(32)).toString("hex");
      const sender = address1;
      const recipient = address2;
      const tokenAddress = `${address1}.${nitMockParams.name}`;

      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data: Cl.bufferFromHex("0x"),
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

    it("Should revert if an invalid implementation is provided", () => {
      const setFlowTx = setFlowLimit({
        tokenId,
        tokenManagerAddress: Cl.contractPrincipal(deployer, "token-manager"),
        limit: Cl.uint(500),
        impl: evilImpl,
      });

      expect(setFlowTx.result).toBeErr(
        ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]
      );
    });

    it("Should revert if the service is paused", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });
      setPaused({ paused: true });
      const setFlowTx = setFlowLimit({
        tokenId,
        tokenManagerAddress: Cl.contractPrincipal(deployer, "token-manager"),
        limit: Cl.uint(500),
      });

      expect(setFlowTx.result).toBeErr(ITS_IMPL_ERROR_CODES["ERR-PAUSED"]);
    });

    it("Should be able to send token only if it does not trigger the mint limit", () => {
      const verificationParams = getTokenManagerMockCv();
      setupTokenManager({
        contract: `${address1}.${tmMockParams.name}`,
        sender: address1,
      });
      deployTokenManager({
        salt,
        tokenManagerAddress: Cl.address(
          `${address1}.${tmMockParams.name}`
        ) as ContractPrincipalCV,
        verificationParams,
      });
      const setFlowTx = setFlowLimit({
        tokenId,
        tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
        limit: Cl.uint(500),
      });

      // test that the transfer limit is not reached
      expect(setFlowTx.result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(501).result).toBeErr(
        TOKEN_MANAGER_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
      expect(sendLockUnlock(200).result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(200).result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(100).result).toBeOk(Cl.bool(true));
      expect(sendLockUnlock(1).result).toBeErr(
        TOKEN_MANAGER_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
    });
    it("Should be able to send token only if it does not trigger the mint limit", () => {
      // setup token manager and set a transfer limit through the ITS
      const verificationParams = getNITMockCv();
      // setup NIT and set a mint limit through the ITS
      setupNIT({
        tokenId,
        minter: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
        sender: address1,
      });
      expect(
        deployInterchainToken({
          salt,
          minter: Cl.address(address1),
          verificationParams,
          token: Cl.address(`${address1}.${nitMockParams.name}`) as ContractPrincipalCV,
        }).result
      ).toBeOk(Cl.bool(true));

      expect(
        mintNIT({
          NITAddress: `${address1}.${nitMockParams.name}`,
          amount: 1000_000,
          minter: address1,
        }).result
      ).toBeOk(Cl.bool(true));
      expect(
        setFlowLimit({
          tokenId,
          limit: Cl.uint(500),
          tokenManagerAddress: Cl.contractPrincipal(address1, nitMockParams.name),
        }).result
      ).toBeOk(Cl.bool(true));
      // test that the transfer limit is not reached
      expect(sendMintBurn(501).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
      expect(sendMintBurn(101).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
      expect(sendMintBurn(100).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(1).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
    });
    it("Should be able to receive token only if it does not trigger the mint limit", () => {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        contract: `${address1}.${nitMockParams.name}`,
        operator: address1,
        sender: address1,
      });
      const deployTx = deployInterchainToken({
        salt,
        minter: Cl.address(address1),
        verificationParams,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));

      mintNIT({
        amount: 1000,
        minter: address1,
        NITAddress: `${address1}.${nitMockParams.name}`,
      });
      expect(
        setFlowLimit({
          tokenId,
          tokenManagerAddress: Cl.contractPrincipal(address1, nitMockParams.name),
          limit: Cl.uint(500),
        }).result
      ).toBeOk(Cl.bool(true));

      expect(getFlowLimit(`${address1}.${nitMockParams.name}`).result).toBeOk(Cl.uint(500));
      expect(receiveMintBurnToken(501).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
      expect(receiveMintBurnToken(100).result).toBeOk(Cl.bufferFromHex("0x"));
      expect(receiveMintBurnToken(200).result).toBeOk(Cl.bufferFromHex("0x"));
      expect(receiveMintBurnToken(200).result).toBeOk(Cl.bufferFromHex("0x"));
      expect(receiveMintBurnToken(1).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
      expect(sendMintBurn(501).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
      expect(sendMintBurn(100).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(200).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(500).result).toBeOk(Cl.bool(true));
      expect(sendMintBurn(1).result).toBeErr(
        NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
      );
    });

    describe("Should be able to set flow limits for each token manager", () => {
      it("lock unlock", () => {
        const verificationParams = getTokenManagerMockCv();
        setupTokenManager({
          contract: `${address1}.${tmMockParams.name}`,
          sender: address1,
        });
        deployTokenManager({
          salt,
          tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
          verificationParams,
        });

        setFlowLimit({
          tokenId,
          tokenManagerAddress: Cl.contractPrincipal(address1, tmMockParams.name),
          limit: Cl.uint(5),
        });
        expect(getFlowLimit(`${address1}.${tmMockParams.name}`).result).toBeOk(Cl.uint(5));
      });
      it("mint burn", () => {
        const verificationParams = getNITMockCv();
        setupNIT({
          tokenId,
          minter: address1,
          sender: address1,
          contract: `${address1}.${nitMockParams.name}`,
          operator: address1,
        });
        const deployTx = deployInterchainToken({
          salt,
          minter: Cl.address(address1),
          verificationParams,
        });
        expect(deployTx.result).toBeOk(Cl.bool(true));

        expect(
          setFlowLimit({
            tokenId,
            tokenManagerAddress: Cl.contractPrincipal(address1, nitMockParams.name),
            limit: Cl.uint(5),
          }).result
        ).toBeOk(Cl.bool(true));
        expect(getFlowLimit(`${address1}.${nitMockParams.name}`).result).toBeOk(Cl.uint(5));
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
          }).result
        ).toBeOk(Cl.bool(true));
        expect(
          isFlowLimiter({
            contractName,
            limiterAddress: address2,
          }).result
        ).toBeOk(Cl.bool(true));

        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeOk(
          Cl.bool(true)
        );
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(contractName);
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        setupNIT({
          tokenId,
          minter: deployer,
          operator: address1,
          sender: deployer,
        });
        runCurrentTests(contractName);
      });
    });

    describe("Should be able to remove a flow limiter", () => {
      function runCurrentTests(contractName: string) {
        const ERROR_NOT_AUTHORIZED =
          contractName === "token-manager"
            ? TOKEN_MANAGER_ERRORS["ERR-NOT-AUTHORIZED"]
            : NIT_ERRORS["ERR-NOT-AUTHORIZED"];
        expect(
          addFlowLimiter({
            contractName,
            limiterAddress: address2,
            operator: address1,
          }).result
        ).toBeOk(Cl.bool(true));
        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeOk(
          Cl.bool(true)
        );
        expect(
          removeFlowLimiter({
            contractName,
            limiterAddress: address2,
            operator: address1,
          }).result
        ).toBeOk(Cl.bool(true));
        expect(
          isFlowLimiter({
            contractName,
            limiterAddress: address2,
          }).result
        ).toBeOk(Cl.bool(false));

        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeErr(
          ERROR_NOT_AUTHORIZED
        );
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(contractName);
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        setupNIT({
          tokenId,
          minter: deployer,
          operator: address1,
          sender: deployer,
        });
        runCurrentTests(contractName);
      });
    });

    describe("Should revert if trying to add a flow limiter as not the operator", () => {
      function runCurrentTests(contractName: string) {
        const ERROR_NOT_AUTHORIZED =
          contractName === "token-manager"
            ? TOKEN_MANAGER_ERRORS["ERR-NOT-AUTHORIZED"]
            : NIT_ERRORS["ERR-NOT-AUTHORIZED"];
        expect(
          addFlowLimiter({
            contractName,
            limiterAddress: address2,
            operator: address2,
          }).result
        ).toBeErr(ERROR_NOT_AUTHORIZED);

        expect(
          isFlowLimiter({
            contractName,
            limiterAddress: address2,
          }).result
        ).toBeOk(Cl.bool(false));

        expect(setTokenFlowLimit(contractName, 100, address2).result).toBeErr(
          ERROR_NOT_AUTHORIZED
        );
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(contractName);
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        setupNIT({ tokenId, minter: deployer, sender: deployer });
        runCurrentTests(contractName);
      });
    });

    describe("Should be able to transfer the operator", () => {
      function runCurrentTests(
        contractName: string,
        operator = address1,
        ERROR_CODE = NIT_ERRORS["ERR-ONLY-OPERATOR"]
      ) {
        expect(isOperator({ contractName, operator: address2 }).result).toBeOk(
          Cl.bool(false)
        );
        expect(isOperator({ contractName, operator: operator }).result).toBeOk(
          Cl.bool(true)
        );
        expect(
          transferTokenOperatorShip({
            contractName,
            operator: operator,
            newOperator: address2,
          }).result
        ).toBeOk(Cl.bool(true));
        expect(isOperator({ contractName, operator: address2 }).result).toBeOk(
          Cl.bool(true)
        );
        expect(isOperator({ contractName, operator: operator }).result).toBeOk(
          Cl.bool(false)
        );

        expect(
          transferTokenOperatorShip({
            contractName,
            operator: operator,
            newOperator: address2,
          }).result
        ).toBeErr(ERROR_CODE);
      }
      it("lock unlock", () => {
        setupTokenManager({});
        const contractName = "token-manager";
        runCurrentTests(
          contractName,
          undefined,
          TOKEN_MANAGER_ERRORS["ERR-NOT-OPERATOR"]
        );
      });
      it("mint burn", () => {
        const contractName = "native-interchain-token";
        expect(
          setupNIT({
            tokenId,
            minter: deployer,
            operator: address1,
            sender: deployer,
          }).result
        ).toBeOk(Cl.bool(true));
        runCurrentTests(contractName);
      });

      it("its", () => {
        const implContractName = "interchain-token-service-impl";
        const operator = deployer;

        expect(
          isOperator({ contractName: implContractName, operator: address2 })
            .result
        ).toBeOk(Cl.bool(false));
        expect(
          isOperator({ contractName: implContractName, operator }).result
        ).toBeOk(Cl.bool(true));
        expect(
          transferITSOperatorShip({
            operator,
            newOperator: address2,
            impl: evilImpl,
          }).result
        ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]);
        expect(
          transferITSOperatorShip({
            operator,
            newOperator: address2,
          }).result
        ).toBeOk(Cl.bool(true));
        expect(
          isOperator({ contractName: implContractName, operator: address2 })
            .result
        ).toBeOk(Cl.bool(true));
        expect(
          isOperator({ contractName: implContractName, operator: operator })
            .result
        ).toBeOk(Cl.bool(false));

        expect(
          transferITSOperatorShip({
            operator: operator,
            newOperator: address2,
          }).result
        ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-ONLY-OPERATOR"]);
      });
    });
  });
  describe("ownership", () => {
    it("should transfer ownership", () => {
      expect(
        transferITSOwnership({
          owner: deployer,
          newOwner: address2,
        }).result
      ).toBeOk(Cl.bool(true));
      expect(
        transferITSOwnership({
          owner: deployer,
          newOwner: address2,
        }).result
      ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-ONLY-OWNER"]);
    });
  });
  it("dynamic dispatch", () => {
    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "call",
        [
          evilImpl,
          gatewayImplCV,
          gasImplContract,
          Cl.stringAscii("foo"),
          Cl.bufferFromHex("0x00"),
        ],
        address1
      ).result
    ).toBeErr(ITS_PROXY_ERROR_CODES["ERR-INVALID-IMPL"]);
    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "call",
        [
          itsImpl,
          gatewayImplCV,
          gasImplContract,
          Cl.stringAscii("foo"),
          Cl.bufferFromHex("0x00"),
        ],
        address1
      ).result
    ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-IMPLEMENTED"]);
  });

  it("Transfer operatorship, owner and operator should set-trusted-address/remove-trusted-address, but others should not", () => {
    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "transfer-operatorship",
        [itsImpl, Cl.principal(address1)],
        deployer
      ).result
    ).toBeOk(Cl.bool(true));

    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "set-trusted-address",
        [
          itsImpl,
          Cl.stringAscii(TRUSTED_CHAIN),
          Cl.stringAscii("any arbitrary address"),
        ],
        deployer
      ).result
    ).toBeOk(Cl.bool(true));

    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "set-trusted-address",
        [
          itsImpl,
          Cl.stringAscii(TRUSTED_CHAIN),
          Cl.stringAscii("any arbitrary address"),
        ],
        address1
      ).result
    ).toBeOk(Cl.bool(true));

    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "set-trusted-address",
        [
          itsImpl,
          Cl.stringAscii(TRUSTED_CHAIN),
          Cl.stringAscii("any arbitrary address"),
        ],
        address2
      ).result
    ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-AUTHORIZED"]);

    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "remove-trusted-address",
        [itsImpl, Cl.stringAscii(TRUSTED_CHAIN)],
        deployer
      ).result
    ).toBeOk(Cl.bool(true));

    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "remove-trusted-address",
        [itsImpl, Cl.stringAscii(TRUSTED_CHAIN)],
        address1
      ).result
    ).toBeOk(Cl.bool(false));

    expect(
      simnet.callPublicFn(
        "interchain-token-service",
        "remove-trusted-address",
        [itsImpl, Cl.stringAscii(TRUSTED_CHAIN)],
        address2
      ).result
    ).toBeErr(ITS_IMPL_ERROR_CODES["ERR-NOT-AUTHORIZED"]);
  });
});
