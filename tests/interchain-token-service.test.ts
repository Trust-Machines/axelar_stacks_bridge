import {
  BufferCV,
  bufferCV,
  contractPrincipalCV,
  cvToJSON,
  falseCV,
  listCV,
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
  makeProofCV,
  Signers,
  signersToCv,
  startContract,
} from "./gateway.test";
import {
  bufferFromHex,
  deserialize,
  serialize,
} from "@stacks/transactions/dist/cl";
import createKeccakHash from "keccak";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

let proofSigners: Signers;
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
  proofSigners = startContract();
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
});
