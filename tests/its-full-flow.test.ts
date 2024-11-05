import { beforeEach, describe, expect, it } from "vitest";
import {
  approveDeployNativeInterchainToken,
  buildOutgoingGMPMessage,
  enableTokenManager,
  executeDeployInterchainToken,
  interchainTransfer,
  keccak256,
  mintNIT,
  setupNIT,
  setupService,
  setupTokenManager,
  transferSip010,
} from "./its-utils";
import {
  factoryDeployInterchainToken,
  deployRemoteCanonicalInterchainToken,
  getCanonicalInterChainTokenId,
  getInterchainTokenId,
  registerCanonicalInterchainToken,
  factoryDeployRemoteInterchainToken,
  getInterchainTokenSalt,
} from "./itf-utils";
import { Cl, cvToHex, randomBytes } from "@stacks/transactions";
import { getSigners } from "./util";
import {
  BURN_ADDRESS,
  MessageType,
  TokenType,
  TRUSTED_ADDRESS,
  TRUSTED_CHAIN,
} from "./constants";
const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;
const proofSigners = getSigners(0, 10, 1, 10, "1");

describe("Interchain Token Service Full Flow", () => {
  const name = "sample";
  const symbol = "SMPL";
  const otherChains = ["ethereum", "avalanche"];
  const decimals = 6;

  /**
   * This test deploys Canonical Interchain tokens for a pre-existing token on remote chains via the InterchainTokenFactory and multicall.
   * Canonical tokens are registered under Lock/Unlock token manager on local chain, and mint/burn on remote chains.
   * They can be deployed to remote chains by anyone, and don't depend on a deployer address/salt.
   * - Register pre-existing token as Canonical
   * - Deploy Canonical Interchain token to each remote chain via the factory
   * - Transfer tokens via ITS between chains after deployment
   */
  describe("Canonical Interchain Token", () => {
    const tokenId = getCanonicalInterChainTokenId({}).value;
    const tokenCap = 1e9;

    beforeEach(async () => {
      // Any ERC20 can be used here
      transferSip010({
        amount: tokenCap,
        sender: deployer,
        recipient: address1,
        contractAddress: "sample-sip-010",
      });
      setupTokenManager({});

      setupService(proofSigners);
      const deployTx = registerCanonicalInterchainToken({});
      expect(deployTx.result).toBeOk(Cl.bool(true));
    });

    it("Should register the token and initiate its deployment on other chains", async () => {
      const { enableTokenTx } = enableTokenManager({
        proofSigners,
        tokenId,
      });

      for (const chain of otherChains) {
        const payload = Cl.tuple({
          "destination-chain": Cl.stringAscii(chain),
          type: Cl.uint(MessageType.SEND_TO_HUB),

          payload: Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(MessageType.DEPLOY_INTERCHAIN_TOKEN),
                "token-id": tokenId,
                name: Cl.stringAscii(name),
                symbol: Cl.stringAscii(symbol),
                decimals: Cl.uint(decimals),
                minter: Cl.bufferFromHex(
                  "0x0000000000000000000000000000000000000000"
                ),
              })
            )
          ),
        });
        const deployRemoteTx = deployRemoteCanonicalInterchainToken({
          destinationChain: chain,
          gasValue: 1000,
        });
        expect(deployRemoteTx.result).toBeOk(Cl.bool(true));

        expect(
          enableTokenTx.events.map((item) => item.data.raw_value)
        ).toContain(
          cvToHex(
            Cl.tuple({
              type: Cl.stringAscii("token-manager-deployed"),
              "token-type": Cl.uint(TokenType.LOCK_UNLOCK),
              "token-manager": Cl.address(`${deployer}.token-manager`),
              "token-id": tokenId,
            })
          )
        );

        expect(
          deployRemoteTx.events.map((item) => item.data.raw_value)
        ).toContain(
          cvToHex(
            Cl.tuple({
              type: Cl.stringAscii("interchain-token-deployment-started"),
              "token-id": tokenId,
              name: Cl.stringAscii(name),
              symbol: Cl.stringAscii(symbol),
              decimals: Cl.uint(decimals),
              minter: Cl.bufferFromHex(
                "0x0000000000000000000000000000000000000000"
              ),
              "destination-chain": Cl.stringAscii(chain),
            })
          )
        );
        expect(
          deployRemoteTx.events.map((item) => item.data.raw_value)
        ).toContain(
          cvToHex(
            Cl.tuple({
              type: Cl.stringAscii("native-gas-paid-for-contract-call"),
              sender: Cl.address(`${deployer}.interchain-token-service`),
              amount: Cl.uint(1000),
              "refund-address": Cl.address(address1),
              "destination-chain": Cl.stringAscii(TRUSTED_CHAIN),
              "destination-address": Cl.stringAscii(TRUSTED_ADDRESS),
              "payload-hash": Cl.buffer(keccak256(Cl.serialize(payload))),
            })
          )
        );
        expect(
          deployRemoteTx.events.map((item) => item.data.raw_value)
        ).toContain(
          cvToHex(
            Cl.tuple(
              buildOutgoingGMPMessage({
                destinationChain: TRUSTED_CHAIN,
                destinationContractAddress: TRUSTED_ADDRESS,
                payload,
                sender: Cl.address(`${deployer}.interchain-token-service`),
              })
            )
          )
        );
      }
    });

    describe("Interchain transfer", () => {
      const amount = 1234;
      const destAddress = "0x1234";
      const destChain = otherChains[0];
      const gasValue = 6789;

      const wrappedPayload = Cl.tuple({
        type: Cl.uint(MessageType.INTERCHAIN_TRANSFER),
        "token-id": tokenId,
        "source-address": Cl.address(address1),
        "destination-address": Cl.bufferFromHex(destAddress),
        amount: Cl.uint(amount),
        data: Cl.bufferFromHex("0x"),
      });
      const payload = Cl.tuple({
        "destination-chain": Cl.stringAscii(destChain),
        type: Cl.uint(MessageType.SEND_TO_HUB),
        payload: Cl.buffer(Cl.serialize(wrappedPayload)),
      });
      const payloadHash = keccak256(Cl.serialize(payload));
      beforeEach(() => {
        expect(
          enableTokenManager({
            proofSigners,
            tokenId,
          }).enableTokenTx.result
        ).toBeOk(Cl.bool(true));
        for (const chain of otherChains) {
          const deployRemoteTx = deployRemoteCanonicalInterchainToken({
            destinationChain: chain,
            gasValue: 1000,
          });
          expect(deployRemoteTx.result).toBeOk(Cl.bool(true));
        }
      });

      it("Should send some tokens to another chain via ITS", async () => {
        const tokenManagerAddress = `${deployer}.token-manager`;
        const transferTx = interchainTransfer({
          amount: Cl.uint(amount),
          destinationAddress: Cl.bufferFromHex(destAddress),
          destinationChain: Cl.stringAscii(destChain),
          gasValue: Cl.uint(gasValue),
          tokenId: tokenId,
          tokenAddress: Cl.address(`${deployer}.sample-sip-010`),
          tokenManagerAddress: Cl.address(tokenManagerAddress),
          caller: address1,
        });

        expect(transferTx.result).toBeOk(Cl.bool(true));

        const [
          tokenLockEvent,
          interchainTransferNotification,
          gasStxTransferEvent,
          gasPaidNotification,
          gmpMessage,
        ] = transferTx.events;

        expect(tokenLockEvent.data).toStrictEqual({
          amount: String(amount),
          asset_identifier: `${deployer}.sample-sip-010::itscoin`,
          recipient: `${deployer}.token-manager`,
          sender: address1,
        });
        expect(interchainTransferNotification.data.value).toBeTuple({
          type: Cl.stringAscii("interchain-transfer"),
          "source-address": Cl.address(address1),
          "destination-address": Cl.bufferFromHex(destAddress),
          "destination-chain": Cl.stringAscii(destChain),
          amount: Cl.uint(amount),
          "token-id": tokenId,
          data: Cl.bufferFromHex("0x" + "0".repeat(64)),
        });
        expect(gasStxTransferEvent.data).toStrictEqual({
          amount: String(gasValue),
          memo: "",
          recipient: `${deployer}.gas-service`,
          sender: address1,
        });
        expect(gasPaidNotification.data.value).toBeTuple({
          type: Cl.stringAscii("native-gas-paid-for-contract-call"),
          "destination-chain": Cl.stringAscii(TRUSTED_CHAIN),
          "destination-address": Cl.stringAscii(TRUSTED_ADDRESS),
          sender: Cl.address(`${deployer}.interchain-token-service`),
          "refund-address": Cl.address(address1),
          "payload-hash": Cl.buffer(payloadHash),
          amount: Cl.uint(gasValue),
        });

        expect(gmpMessage.data.value).toBeTuple(
          buildOutgoingGMPMessage({
            destinationChain: TRUSTED_CHAIN,
            destinationContractAddress: TRUSTED_ADDRESS,
            payload,
            sender: Cl.address(`${deployer}.interchain-token-service`),
          })
        );
      });
    });
  });

  /**
   * This test deploys brand new Interchain tokens to all chains via the InterchainTokenFactory and multicall:
   * - Deploy new Interchain token on local chain via the factory with an initial supply
   * - Deploy new Interchain token to each remote chain via the factory
   * - Transfer token via native method on the token
   * - Transfer tokens via ITS between chains after deployment
   * - Transfers mint/burn role from original deployer wallet to another address
   */
  describe("New Interchain token", () => {
    // let token;
    const originalSalt = randomBytes(32);
    const interchainTokenSalt = getInterchainTokenSalt({
      salt: originalSalt,
      deployer: address1,
    });
    const tokenId = getInterchainTokenId({
      salt: interchainTokenSalt,
      deployer: Cl.address(BURN_ADDRESS),
      sender: address1,
    }).value;

    const gasValues = [1234, 5678];
    const tokenCap = 1e9;
    beforeEach(() => {
      setupService(proofSigners);
      setupNIT({
        tokenId,
        minter: address1,
      });
    });
    it("Should register the token and initiate its deployment on other chains", async () => {
      const totalMint = tokenCap;
      mintNIT({
        minter: address1,
        amount: totalMint,
      });
      // Deploy a new Interchain token on the local chain.
      // The initial mint occurs on the factory contract, so it can be moved to other chains within the same multicall.
      const localDeployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        gasValue: gasValues[0],
        initialSupply: totalMint,
        minterAddress: address1,
        tokenAddress: `${deployer}.native-interchain-token`,
      });

      const { payload } = approveDeployNativeInterchainToken({
        tokenId,
        proofSigners,
        minter: address1,
        supply: totalMint,
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

      expect(localDeployTx.result).toBeOk(Cl.bool(true));

      // Deploy a linked Interchain token to remote chains.
      for (const chain of otherChains) {
        const payload = Cl.tuple({
          "destination-chain": Cl.stringAscii(chain),
          type: Cl.uint(MessageType.SEND_TO_HUB),
          payload: Cl.buffer(
            Cl.serialize(
              Cl.tuple({
                type: Cl.uint(MessageType.DEPLOY_INTERCHAIN_TOKEN),
                "token-id": tokenId,
                name: Cl.stringAscii("Nitter"),
                symbol: Cl.stringAscii("NIT"),
                decimals: Cl.uint(decimals),
                minter: Cl.buffer(Cl.serialize(Cl.address(address1))),
              })
            )
          ),
        });
        const deployTx = factoryDeployRemoteInterchainToken({
          salt: originalSalt,
          tokenAddress: `${deployer}.native-interchain-token`,
          tokenManagerAddress: `${deployer}.native-interchain-token`,
          destinationChain: chain,
          gasValue: 100,
          sender: address1,
          minterHex: cvToHex(Cl.address(address1)),
        });

        expect(deployTx.result).toBeOk(Cl.bool(true));
        const [
          deploymentNotification,
          gasStxTransferEvent,
          gasPaidNotification,
          gmpMessage,
        ] = deployTx.events;
        expect(gasPaidNotification.data.value).toBeTuple({
          amount: Cl.uint(100),
          "destination-chain": Cl.stringAscii(TRUSTED_CHAIN),
          "destination-address": Cl.stringAscii(TRUSTED_ADDRESS),
          "payload-hash": Cl.buffer(keccak256(Cl.serialize(payload))),
          "refund-address": Cl.address(address1),
          sender: Cl.address(`${deployer}.interchain-token-service`),
          type: Cl.stringAscii("native-gas-paid-for-contract-call"),
        });

        expect(gasStxTransferEvent.data).toStrictEqual({
          amount: "100",
          memo: "",
          recipient: `${deployer}.gas-service`,
          sender: address1,
        });
        expect(deploymentNotification.data.value).toBeTuple({
          type: Cl.stringAscii("interchain-token-deployment-started"),
          name: Cl.stringAscii("Nitter"),
          symbol: Cl.stringAscii("NIT"),
          minter: Cl.buffer(Cl.serialize(Cl.address(address1))),
          "token-id": tokenId,
          "destination-chain": Cl.stringAscii(chain),
          decimals: Cl.uint(decimals),
        });
        expect(gmpMessage.data.value).toBeTuple(
          buildOutgoingGMPMessage({
            destinationChain: TRUSTED_CHAIN,
            destinationContractAddress: TRUSTED_ADDRESS,
            payload,
            sender: Cl.address(`${deployer}.interchain-token-service`),
          })
        );
      }
    });
  });
});
