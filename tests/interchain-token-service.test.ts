import {
  boolCV,
  BufferCV,
  bufferCV,
  bufferCVFromString,
  contractPrincipalCV,
  cvToJSON,
  falseCV,
  listCV,
  principalCV,
  randomBytes,
  serializeCV,
  someCV,
  standardPrincipalCV,
  stringAsciiCV,
  trueCV,
  tupleCV,
  uintCV,
} from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bufferFromAscii,
  bufferFromHex,
  deserialize,
  serialize,
} from "@stacks/transactions/dist/cl";
import createKeccakHash from "keccak";
import { signMessageHashForAddress, SIGNER_KEYS } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;
const operator_address = accounts.get("wallet_1")!;
const contract_caller = accounts.get("wallet_2")!;

export type Signers = {
  signers: {
    signer: string,
    weight: number
  }[],
  threshold: number,
  nonce: string
}

export const signersToCv = (data: Signers) => {
  return tupleCV({
    "signers": listCV([
      ...data.signers.map(x => tupleCV({
        "signer": bufferFromHex(x.signer),
        "weight": uintCV(x.weight)
      }))

    ]),
    "threshold": uintCV(data.threshold),
    "nonce": bufferFromAscii(data.nonce)
  })
}

export const makeProofCV = (data: Signers, messageHashToSign: string) => {
  return tupleCV({
    "signers": signersToCv(data),
    "signatures": listCV([
      ...data.signers.map((x) => bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), x.signer)))
    ])
  });
}

const getSigners = (start: number, end: number, weight: number, threshold: number, nonce: string): Signers => {
  return {
    signers: Object.keys(SIGNER_KEYS).slice(start, end).map(s => ({
      signer: s,
      weight
    })),
    threshold,
    nonce
  }
}
let proofSigners = getSigners(0, 10, 1, 10, "1");

export const startContract = () => {

  const operator = principalCV(operator_address);
  const domainSeparator = bufferCVFromString('stacks-axelar-1');
  const minimumRotationDelay = uintCV(0);
  const previousSignersRetention = uintCV(15);

  expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signersToCv(proofSigners))), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], contract_caller).result).toBeOk(boolCV(true));
}
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
        stringAsciiCV("interchain-token-service"),
        contractPrincipalCV(deployer, "interchain-token-factory"),
        contractPrincipalCV(deployer, "gateway"),
        contractPrincipalCV(deployer, "gas-service"),
        standardPrincipalCV(deployer),
        listCV([
          tupleCV({
            "chain-name": stringAsciiCV("ethereum"),
            address: stringAsciiCV("0x00"),
          }),
        ]),
      ],
      deployer
    ).result
  ).toBeOk(trueCV());
  startContract();
}
describe("Interchain Token Service", () => {
  beforeEach(setupService);
  describe("Owner functions", () => {
    it("Should revert on set pause status when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-paused",
          [trueCV()],
          address1
        ).result
      ).toBeErr(uintCV(1051));
    });

    it("Should revert on set trusted address when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [stringAsciiCV("ethereum"), stringAsciiCV("0x00")],
          address1
        ).result
      ).toBeErr(uintCV(1051));
    });

    it("Should set trusted address", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "set-trusted-address",
          [stringAsciiCV("ethereum"), stringAsciiCV("0x00")],
          deployer
        ).result
      ).toBeOk(trueCV());
    });

    it("Should revert on remove trusted address when not called by the owner", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [stringAsciiCV("ethereum")],
          address1
        ).result
      ).toBeErr(uintCV(1051));
    });

    it("Should remove trusted address", () => {
      expect(
        simnet.callPublicFn(
          "interchain-token-service",
          "remove-trusted-address",
          [stringAsciiCV("ethereum")],
          deployer
        ).result
      ).toBeOk(trueCV());
    });
  });

  describe("Deploy and Register Interchain Token", () => {
    const tokenName = "sample";
    const tokenSymbol = "SMPL";
    const tokenDecimals = 6;
    const salt = randomBytes(32);

    let tokenManager;
    it("Should register an existing token with its manager", () => {
      expect(
        simnet.callPublicFn(
          "token-manager",
          "setup",
          [
            contractPrincipalCV(deployer, "sample-sip-010"),
            uintCV(2),
            contractPrincipalCV(deployer, "interchain-token-service"),
            someCV(standardPrincipalCV(deployer)),
          ],
          deployer
        ).result
      ).toBeOk(trueCV());
      const deployTx = simnet.callPublicFn(
        "interchain-token-service",
        "deploy-token-manager",
        [
          bufferCV(salt),
          stringAsciiCV(""),
          uintCV(2),
          contractPrincipalCV(deployer, "sample-sip-010"),
          contractPrincipalCV(deployer, "token-manager"),
          uintCV(0),
        ],
        deployer
      );

      expect(deployTx.result).toBeOk(trueCV());
    });

    it("Should revert when registering an interchain token as a lock/unlock for a second time", () => {
      const tokenId = simnet.callReadOnlyFn(
        "interchain-token-service",
        "interchain-token-id",
        [standardPrincipalCV(deployer), bufferCV(salt)],
        deployer
      ).result as BufferCV;

      expect(
        simnet.callPublicFn(
          "token-manager",
          "setup",
          [
            contractPrincipalCV(deployer, "sample-sip-010"),
            uintCV(2),
            contractPrincipalCV(deployer, "interchain-token-service"),
            someCV(standardPrincipalCV(deployer)),
          ],
          deployer
        ).result
      ).toBeOk(trueCV());
      const deployTx = simnet.callPublicFn(
        "interchain-token-service",
        "deploy-token-manager",
        [
          bufferCV(salt),
          stringAsciiCV(""),
          uintCV(2),
          contractPrincipalCV(deployer, "sample-sip-010"),
          contractPrincipalCV(deployer, "token-manager"),
          uintCV(0),
        ],
        deployer
      );

      expect(deployTx.result).toBeOk(trueCV());
      expect(deployTx.events[0].event).toBe("print_event");
      expect(deserialize(deployTx.events[0].data.raw_value!)).toBeTuple({
        type: stringAsciiCV("interchain-token-id-claimed"),
        "token-id": tokenId,
        deployer: standardPrincipalCV(deployer),
        salt: bufferCV(salt),
      });

      const payload = tupleCV({
        type: stringAsciiCV("verify-token-manager"),
        "token-address": contractPrincipalCV(deployer, "sample-sip-010"),
        "token-manager-address": contractPrincipalCV(deployer, "token-manager"),
        "token-id": tokenId,
        "token-type": uintCV(2),
      });

      const message = {
        type: stringAsciiCV("contract-call"),
        sender: contractPrincipalCV(deployer, "interchain-token-service"),
        "destination-chain": stringAsciiCV("stacks"),
        "destination-contract-address": stringAsciiCV(
          "interchain-token-service"
        ),
        payload: bufferCV(serialize(payload)),
        "payload-hash": bufferCV(
          createKeccakHash("keccak256")
            .update(Buffer.from(serialize(payload)))
            .digest()
        ),
      };
      expect(deployTx.events[1].event).toBe("print_event");
      expect(deserialize(deployTx.events[1].data.raw_value!)).toBeTuple(
        message
      );

      const messages = listCV([
        tupleCV({
          "source-chain": stringAsciiCV("stacks"),
          "message-id": stringAsciiCV("0x00"),
          "source-address": stringAsciiCV("interchain-token-service"),
          "contract-address": contractPrincipalCV(
            deployer,
            "interchain-token-service"
          ),
          "payload-hash": bufferCV(
            createKeccakHash("keccak256")
              .update(Buffer.from(serialize(payload)))
              .digest()
          ),
        }),
      ]);

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn(
          "gateway",
          "data-hash-from-messages",
          [messages],
          deployer
        );
        return cvToJSON(result).value.replace("0x", "");
      })();

      expect(dataHash).toBe(
        createKeccakHash("keccak256")
          .update(
            Buffer.from(
              serialize(
                tupleCV({
                  data: messages,
                  type: stringAsciiCV("approve-messages"),
                })
              )
            )
          )
          .digest("hex")
      );
      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn(
          "gateway",
          "get-signers-hash",
          [signersToCv(proofSigners)],
          deployer
        );
        return cvToJSON(result).value;
      })();
      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn(
          "gateway",
          "message-hash-to-sign",
          [bufferFromHex(signersHash), bufferFromHex(dataHash)],
          deployer
        );
        return cvToJSON(result).value;
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);
      const { result: approveResult, events: approveEvents } =
        simnet.callPublicFn(
          "gateway",
          "approve-messages",
          [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))],
          deployer
        );

      expect(approveResult).toBeOk(trueCV());


      const isApprovedBefore = simnet.callReadOnlyFn(
        "gateway",
        "is-message-approved",
        [
          stringAsciiCV("stacks"),
          stringAsciiCV("0x00"),
          stringAsciiCV("interchain-token-service"),
          contractPrincipalCV(deployer, "interchain-token-service"),
          bufferCV(
            createKeccakHash("keccak256")
              .update(Buffer.from(serialize(payload)))
              .digest()
          ),
        ],
        deployer
      ).result;
      expect(isApprovedBefore).toBeOk(trueCV());

      const isExecutedBefore = simnet.callReadOnlyFn(
        "gateway",
        "is-message-executed",
        [stringAsciiCV("stacks"), stringAsciiCV("0x00")],
        deployer
      ).result;
      expect(isExecutedBefore).toBeOk(falseCV());

      const enableTokenTx = simnet.callPublicFn(
        "interchain-token-service",
        "execute-enable-token",
        [stringAsciiCV("0x00"), stringAsciiCV("stacks"), stringAsciiCV("interchain-token-service"), bufferCV(serializeCV(payload))],
        deployer
      );
      expect(enableTokenTx.result).toBeOk(trueCV());
      expect(simnet.callReadOnlyFn(
        "gateway",
        "is-message-executed",
        [stringAsciiCV("stacks"), stringAsciiCV("0x00")],
        deployer
      ).result).toBeOk(trueCV());
      const secondDeployTx = simnet.callPublicFn(
        "interchain-token-service",
        "deploy-token-manager",
        [
          bufferCV(salt),
          stringAsciiCV(""),
          uintCV(2),
          contractPrincipalCV(deployer, "sample-sip-010"),
          contractPrincipalCV(deployer, "token-manager"),
          uintCV(0),
        ],
        deployer
      );
      expect(secondDeployTx.result).toBeErr(uintCV(2054));
    });

    it("Should revert when registering an interchain token when service is paused", () => {});
  });

  describe("Deploy and Register remote Interchain Token", () => {
    it("Should initialize a remote interchain token deployment", () => {});

    it("Should revert on remote interchain token deployment if destination chain is not trusted", () => {});

    it("Should revert on remote interchain token deployment if paused", () => {});
  });

  describe("Receive Remote Interchain Token Deployment", () => {
    it("Should revert on receiving a remote interchain token deployment if not approved by the gateway", () => {});

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
