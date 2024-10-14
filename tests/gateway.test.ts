
import { boolCV, BufferCV, bufferCV, bufferCVFromString, cvToJSON, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromAscii, bufferFromHex } from "@stacks/transactions/dist/cl";
import { describe, expect, it } from "vitest";
import { signMessageHashForAddress } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("Gateway tests", () => {

  it("Should revert before initialization", () => {
    const newSigners = tupleCV({
      "signers": listCV([
        tupleCV({
          "signer": principalCV(accounts.get("wallet_1")!),
          "weight": uintCV(1)
        }),
      ]),
      "threshold": uintCV(1),
      "nonce": bufferFromHex("0xf74616ab34b70062ff83d0f3459bee08066c0b32ed44ed6f4c52723036ee295c")
    });

    const proofSigners = tupleCV({
      "signers": listCV([
        tupleCV({
          "signer": principalCV(accounts.get("wallet_2")!),
          "weight": uintCV(1)
        })
      ]),
      "threshold": uintCV(1),
      "nonce": bufferFromHex("0x97550c84a9e30d01461a29ac1c54c29e82c1925ee78b2ee1776d9e20c0183334")
    })

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [proofSigners], address1);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [newSigners], address1);
      return cvToJSON(result).value;
    })();

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], address1);
      return cvToJSON(result).value
    })();

    const proof = tupleCV({
      "signers": proofSigners,
      "signatures": listCV([
        bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), address1))
      ])
    });

    const messages = listCV([
      tupleCV({
        "source-chain": stringAsciiCV("foo"),
        "message-id": stringAsciiCV("bar"),
        "source-address": stringAsciiCV("baz"),
        "contract-address": bufferCVFromString("x"),
        "payload-hash": bufferCVFromString("y")
      })
    ]);

    // all public functions should revert before initialization
    // 4051 since signer-epoch is 0 by default
    expect(simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(newSigners)), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(4051));
    // 6052
    expect(simnet.callPublicFn("gateway", "call-contract", [stringAsciiCV("foo"), stringAsciiCV("bar"), bufferFromAscii("baz")], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "validate-message", [stringAsciiCV("foo"), stringAsciiCV("bar"), stringAsciiCV("baz"), bufferFromAscii("x")], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(address1)], address1).result).toBeErr(uintCV(6052));
  });

  it("Initialization", () => {
    const { result: getIsStarted1 } = simnet.callReadOnlyFn("gateway", "get-is-started", [], address1);
    expect(getIsStarted1).toBeBool(false);

    const signers = tupleCV({
      "signers": listCV([
        tupleCV({
          "signer": principalCV(accounts.get("wallet_1")!),
          "weight": uintCV(1)
        }),
        tupleCV({
          "signer": principalCV(accounts.get("wallet_2")!),
          "weight": uintCV(1)
        }),
        tupleCV({
          "signer": principalCV(accounts.get("wallet_3")!),
          "weight": uintCV(1)
        }),
        tupleCV({
          "signer": principalCV(accounts.get("wallet_4")!),
          "weight": uintCV(1)
        }),
        tupleCV({
          "signer": principalCV(accounts.get("wallet_5")!),
          "weight": uintCV(1)
        }),
      ]),
      "threshold": uintCV(5),
      "nonce": bufferFromHex("0xf74616ab34b70062ff83d0f3459bee08066c0b32ed44ed6f4c52723036ee295c")
    });

    const operator = principalCV(address1);
    const domainSeparator = bufferCVFromString('stacks-axelar-1');
    const minimumRotationDelay = uintCV(0);
    const previousSignersRetention = uintCV(15);

    expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signers)), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], address1).result).toBeOk(boolCV(true));

    // check init values 
    expect(simnet.callReadOnlyFn("gateway", "get-operator", [], address1).result).toBePrincipal(address1);
    expect(Buffer.from((simnet.callReadOnlyFn("gateway", "get-domain-separator", [], address1).result as BufferCV).buffer).toString("ascii")).toBe("stacks-axelar-1");
    expect(simnet.callReadOnlyFn("gateway", "get-minimum-rotation-delay", [], address1).result).toBeUint(0);
    expect(simnet.callReadOnlyFn("gateway", "get-previous-signers-retention", [], address1).result).toBeUint(15);
    expect(simnet.callReadOnlyFn("gateway", "get-is-started", [], address1).result).toBeBool(true);

    // already initialized
    expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signers)), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], address1).result).toBeErr(uintCV(6051));

  });

  it("message-to-command-id", () => {
    expect(simnet.callReadOnlyFn("gateway", "message-to-command-id", [stringAsciiCV('Source'), stringAsciiCV('1')], address1).result).toBeBuff(bufferFromHex("0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae").buffer)
  });


  /*
  it("Rotate signers", () => {
    const newSigners = tupleCV({
      "signers": listCV([
        tupleCV({
          "signer": principalCV(accounts.get("wallet_1")!),
          "weight": uintCV(1)
        }),
        tupleCV({
          "signer": principalCV(accounts.get("wallet_2")!),
          "weight": uintCV(2)
        }),
        tupleCV({
          "signer": principalCV(accounts.get("wallet_3")!),
          "weight": uintCV(2)
        }),
      ]),
      "threshold": uintCV(3),
      "nonce": bufferFromHex("0xf74616ab34b70062ff83d0f3459bee08066c0b32ed44ed6f4c52723036ee295c") // (keccak256 u1)
    });

    const proofSigners =  tupleCV({
      "signers": listCV([
        tupleCV({
          "signer": principalCV('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'),
          "weight": uintCV(1)
        })
      ]),
      "threshold": uintCV(1),
      "nonce": bufferFromHex("0x97550c84a9e30d01461a29ac1c54c29e82c1925ee78b2ee1776d9e20c0183334") // (keccak256 u2)
    })

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [proofSigners], address1);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [newSigners, stringAsciiCV("rotate-signers")], address1);
      return cvToJSON(result).value;
    })();

    expect(signersHash).toEqual("0xeb10ff1e268b2c648c7abfc4e6bc0deb2cf349726252b4286e21190a8fcc3651");
    expect(dataHash).toEqual("0x6875c2c5d917a3dc6e4608f0fe82735cc14222f0783d65fe302472aaf7969ff4");

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], address1);
      return cvToJSON(result).value
    })();

    const proof = tupleCV({
      "signers": proofSigners,
      "signatures": listCV([
         bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'))
      ])
    });

    expect(messageHashToSign).toEqual("0xa7e1eb7c736ac708bc76f23261e273d3c068359370c5b8419637dbfaf760ba6b");

    const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(newSigners)), bufferCV(serializeCV(proof))], 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    
    expect(result).toBeOk(boolCV(true));
  });
  */
});

