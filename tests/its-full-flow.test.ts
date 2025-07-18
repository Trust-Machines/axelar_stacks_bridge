import { Cl, cvToHex, randomBytes } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";
import {
  MessageType,
  MetadataVersion,
  NIT_ERRORS,
  TRUSTED_ADDRESS,
  TRUSTED_CHAIN,
} from "./constants";
import {
  deployRemoteCanonicalInterchainToken,
  factoryDeployInterchainToken,
  factoryDeployRemoteInterchainToken,
  getCanonicalInterChainTokenId,
  getInterchainTokenId,
  registerCanonicalInterchainToken,
} from "./itf-utils";
import {
  approveReceiveInterchainTransfer,
  buildIncomingInterchainTransferPayload,
  buildOutgoingGMPMessage,
  executeReceiveInterchainToken,
  getCommandId,
  getHelloWorldValue,
  getSip010Balance,
  interchainTransfer,
  isMinter,
  keccak256,
  mintNIT,
  setupNIT,
  setupService,
  setupTokenManager,
  transferMinterShip,
  transferSip010,
} from "./its-utils";
import { getSigners } from "./util";
import { getNITMockCv, getTokenManagerMockCv } from "./verification-util";
const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;

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
      const verificationParams = getTokenManagerMockCv();
      expect(
        setupTokenManager({
          contract: `${address1}.token-man`,
          sender: address1,
          operator: null,
        }).result,
      ).toBeOk(Cl.bool(true));

      setupService(proofSigners);
      const deployTx = registerCanonicalInterchainToken({
        verificationParams,
        tokenManagerAddress: `${address1}.token-man`,
        sender: address1,
      });
      expect(deployTx.result).toBeOk(Cl.bool(true));
    });

    it("Should register the token and initiate its deployment on other chains", async () => {
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
                  "0x",
                ),
              }),
            ),
          ),
        });
        const deployRemoteTx = deployRemoteCanonicalInterchainToken({
          destinationChain: chain,
          gasValue: 1000,
        });
        expect(deployRemoteTx.result).toBeOk(Cl.bool(true));

        expect(
          deployRemoteTx.events.map((item) => item.data.raw_value),
        ).toContain(
          cvToHex(
            Cl.tuple({
              type: Cl.stringAscii("interchain-token-deployment-started"),
              "token-id": tokenId,
              name: Cl.stringAscii(name),
              symbol: Cl.stringAscii(symbol),
              decimals: Cl.uint(decimals),
              minter: Cl.bufferFromHex(
                "0x",
              ),
              "destination-chain": Cl.stringAscii(chain),
            }),
          ),
        );
        expect(
          deployRemoteTx.events.map((item) => item.data.raw_value),
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
            }),
          ),
        );
        expect(
          deployRemoteTx.events.map((item) => item.data.raw_value),
        ).toContain(
          cvToHex(
            Cl.tuple(
              buildOutgoingGMPMessage({
                destinationChain: TRUSTED_CHAIN,
                destinationContractAddress: TRUSTED_ADDRESS,
                payload,
                sender: Cl.address(`${deployer}.interchain-token-service`),
              }),
            ),
          ),
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
        for (const chain of otherChains) {
          const deployRemoteTx = deployRemoteCanonicalInterchainToken({
            destinationChain: chain,
            gasValue: 1000,
          });
          expect(deployRemoteTx.result).toBeOk(Cl.bool(true));
        }
      });

      it("Should send some tokens to another chain via ITS", async () => {
        const tokenManagerAddress = `${address1}.token-man`;
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
          recipient: tokenManagerAddress,
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
          recipient: `${deployer}.gas-impl`,
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
          }),
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

    const tokenId = getInterchainTokenId({
      salt: Cl.buffer(originalSalt),
      deployer: Cl.address(address1),
      sender: address1,
    }).value;

    const gasValues = [1234, 5678];
    const tokenCap = 1e9;
    function deployNIT() {
      const verificationParams = getNITMockCv();
      setupNIT({
        tokenId,
        minter: address1,
        operator: address1,
        sender: address1,
        contract: `${address1}.nit`,
      });
      expect(
        mintNIT({
          minter: address1,
          amount: tokenCap,
          NITAddress: `${address1}.nit`,
        }).result,
      ).toBeOk(Cl.bool(true));

      const localDeployTx = factoryDeployInterchainToken({
        salt: originalSalt,
        sender: address1,
        initialSupply: tokenCap,
        minterAddress: address1,
        tokenAddress: `${address1}.nit`,
        verificationParams,
      });

      expect(localDeployTx.result).toBeOk(Cl.bool(true));
    }
    beforeEach(() => {
      setupService(proofSigners);

      // Deploy a new Interchain token on the local chain.
      // The initial mint occurs on the factory contract, so it can be moved to other chains within the same multicall.
      deployNIT();
    });

    it("Should register the token and initiate its deployment on other chains", async () => {
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
              }),
            ),
          ),
        });
        const deployTx = factoryDeployRemoteInterchainToken({
          salt: originalSalt,
          tokenAddress: `${address1}.nit`,
          tokenManagerAddress: `${address1}.nit`,
          destinationChain: chain,
          gasValue: 100,
          sender: address1,
          minter: address1,
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
          recipient: `${deployer}.gas-impl`,
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
          }),
        );
      }
    });

    describe("Interchain transfer", () => {
      const amount = 1234;
      const destAddress = "0x1234";
      const gasValue = 6789;
      function transferToChain({ chain, gas }: { chain: string; gas: number }) {
        const wrappedPayload = Cl.tuple({
          type: Cl.uint(MessageType.INTERCHAIN_TRANSFER),
          "token-id": tokenId,
          "source-address": Cl.address(address1),
          "destination-address": Cl.bufferFromHex(destAddress),
          amount: Cl.uint(amount),
          data: Cl.bufferFromHex("0x"),
        });
        const payload = Cl.tuple({
          "destination-chain": Cl.stringAscii(chain),
          type: Cl.uint(MessageType.SEND_TO_HUB),
          payload: Cl.buffer(Cl.serialize(wrappedPayload)),
        });
        const payloadHash = keccak256(Cl.serialize(payload));

        const transferTx = interchainTransfer({
          amount: Cl.uint(amount),
          destinationChain: Cl.stringAscii(chain),
          destinationAddress: Cl.bufferFromHex(destAddress),
          gasValue: Cl.uint(gas),
          tokenAddress: Cl.address(`${address1}.nit`),
          tokenId: tokenId,
          tokenManagerAddress: Cl.address(`${address1}.nit`),
          metadata: {
            data: Cl.bufferFromHex("0x"),
            version: Cl.uint(MetadataVersion.ContractCall),
          },
          caller: address1,
        });
        expect(transferTx.result).toBeOk(Cl.bool(true));

        const [
          tokenBurnEvent,
          interchainTransferNotification,
          gasStxTransferEvent,
          gasPaidNotification,
          gmpMessage,
        ] = transferTx.events;
        expect(tokenBurnEvent).toStrictEqual({
          event: "ft_burn_event",
          data: {
            amount: String(amount),
            asset_identifier: `${address1}.nit::itscoin`,
            sender: address1,
          },
        });
        expect(interchainTransferNotification.data.value).toBeTuple({
          amount: Cl.uint(amount),
          data: Cl.bufferFromHex("0x" + "0".repeat(64)),
          "destination-address": Cl.bufferFromHex(destAddress),
          "destination-chain": Cl.stringAscii(chain),
          "source-address": Cl.principal(address1),
          "token-id": tokenId,
          type: Cl.stringAscii("interchain-transfer"),
        });
        expect(gasStxTransferEvent).toStrictEqual({
          event: "stx_transfer_event",
          data: {
            amount: String(gas),
            memo: "",
            recipient: `${deployer}.gas-impl`,
            sender: address1,
          },
        });
        expect(gasPaidNotification.data.value).toBeTuple({
          amount: Cl.uint(gas),
          "destination-chain": Cl.stringAscii(TRUSTED_CHAIN),
          "destination-address": Cl.stringAscii(TRUSTED_ADDRESS),
          "payload-hash": Cl.buffer(payloadHash),
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
      }
      it("Should send some tokens to another chain via ITS Hub", async () => {
        const destChain = otherChains[0];

        transferToChain({ chain: destChain, gas: gasValue });
      });

      it("Should send some tokens to multiple chains via ITS Hub", async () => {
        for (let i = 0; i < otherChains.length; i++) {
          transferToChain({ chain: otherChains[i], gas: gasValues[i] });
        }
      });
    });

    /**
     * Change the minter to another address
     */
    it("Should be able to change the token minter", async () => {
      expect(
        isMinter({ contract: `${address1}.nit`, address: address1 }),
      ).toBeOk(Cl.bool(true));
      expect(
        isMinter({ contract: `${address1}.nit`, address: address2 }),
      ).toBeOk(Cl.bool(false));

      let transferMinterTx = transferMinterShip({
        contract: `${address1}.nit`,
        newMinter: address2,
        sender: address2,
      });

      expect(transferMinterTx.result).toBeErr(NIT_ERRORS["ERR-NOT-AUTHORIZED"]);

      transferMinterTx = transferMinterShip({
        contract: `${address1}.nit`,
        newMinter: address2,
        sender: address1,
      });
      expect(transferMinterTx.result).toBeOk(Cl.bool(true));

      expect(
        isMinter({ contract: `${address1}.nit`, address: address1 }),
      ).toBeOk(Cl.bool(false));
      expect(
        isMinter({ contract: `${address1}.nit`, address: address2 }),
      ).toBeOk(Cl.bool(true));

      expect(
        mintNIT({
          minter: address1,
          amount: 100,
          NITAddress: `${address1}.nit`,
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-NOT-AUTHORIZED"]);

      const prevBalance = getSip010Balance({
        address: address2,
        contractAddress: `${address1}.nit`,
      });
      expect(
        mintNIT({
          minter: address2,
          amount: 100,
          NITAddress: `${address1}.nit`,
        }).result,
      ).toBeOk(Cl.bool(true));

      const newBalance = getSip010Balance({
        address: address2,
        contractAddress: `${address1}.nit`,
      });
      expect(newBalance).toBe(prevBalance + 100n);
    });

    it("Should execute an application with interchain transfer via ITS Hub", async () => {
      const amount = 1234;
      const sourceChain = otherChains[0];
      const recipient = `${deployer}.hello-world`;
      const sender = address1;
      const messageId = Buffer.from(randomBytes(32)).toString("hex");
      const data = Cl.bufferFromHex("0x1234");
      const payload = buildIncomingInterchainTransferPayload({
        amount,
        recipient,
        sender,
        tokenId,
        data,
        sourceChain,
      });
      approveReceiveInterchainTransfer({
        payload,
        proofSigners,
        messageId,
      });
      const receiveTokenTx = executeReceiveInterchainToken({
        messageId,
        sourceChain: TRUSTED_CHAIN,
        sourceAddress: TRUSTED_ADDRESS,
        tokenManager: Cl.contractPrincipal(address1, "nit"),
        token: Cl.contractPrincipal(address1, "nit"),
        payload: Cl.buffer(Cl.serialize(payload)),
        destinationContract: Cl.contractPrincipal(deployer, "hello-world"),
      });
      expect(receiveTokenTx.result).toBeOk(
        Cl.buffer(
          keccak256(Cl.serialize(Cl.stringAscii("its-execute-success"))),
        ),
      );

      const [gmpValidateEvent, tokenMintEvent, tokenReceivedNotification] =
        receiveTokenTx.events;
      expect(gmpValidateEvent.data.value).toBeTuple({
        type: Cl.stringAscii("message-executed"),
        "command-id": Cl.buffer(
          getCommandId({ sourceChain: TRUSTED_CHAIN, messageId }),
        ),
        "message-id": Cl.stringAscii(messageId),
        "source-chain": Cl.stringAscii(TRUSTED_CHAIN),
      });
      expect(tokenMintEvent).toStrictEqual({
        event: "ft_mint_event",
        data: {
          amount: String(amount),
          asset_identifier: `${address1}.nit::itscoin`,
          recipient: `${deployer}.hello-world`,
        },
      });

      expect(tokenReceivedNotification.data.value).toBeTuple({
        type: Cl.stringAscii("interchain-transfer-received"),
        amount: Cl.uint(amount),
        data: Cl.buffer(keccak256(data.buffer)),
        "destination-address": Cl.address(`${deployer}.hello-world`),
        "source-address": Cl.buffer(Cl.serialize(Cl.address(sender))),
        "source-chain": Cl.stringAscii(sourceChain),
        "token-id": tokenId,
      });

      const helloWorldValue = getHelloWorldValue();

      expect(helloWorldValue).toBeTuple({
        "source-chain": Cl.stringAscii(sourceChain),
        "message-id": Cl.stringAscii(messageId),
        "source-address": Cl.stringAscii(""),
        "source-address-its": Cl.buffer(Cl.serialize(Cl.address(sender))),
        payload: data,
      });
    });
  });
});
