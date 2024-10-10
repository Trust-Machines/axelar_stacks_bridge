
import { bufferCV, cvToJSON, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromHex, stringAscii } from "@stacks/transactions/dist/cl";
import { describe, expect, it } from "vitest";
import { signMessageHashForAddress } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

describe("Gateway tests", () => {
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
      "nonce": bufferFromHex("0x97550c84a9e30d01461a29ac1c54c29e82c1925ee78b2ee1776d9e20c0183334") // (keccak256 u1)
    });

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [newSigners], address1);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [newSigners, stringAsciiCV("rotate-signers")], address1);
      return cvToJSON(result).value;
    })();


    expect(signersHash).toEqual("0x1bf393d7c685b8aae99fcc0acbe989c7731fea11a36e5403e24648996a0cd325");
    expect(dataHash).toEqual("0x56b1d353ae2b681305d53391e1942d6d25265ed76646dbbcbcb7b44366cac180");

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], address1);
      return cvToJSON(result).value
    })();

    expect(messageHashToSign).toEqual("0x6e5b2e14cc352e211ea134cbd1622bb423b6872e175ddf1b911dd268489a0bba");

    const signatures = [accounts.get("wallet_1")!, accounts.get("wallet_2")!, accounts.get("wallet_3")!].map(x => signMessageHashForAddress(messageHashToSign.replace('0x', ''), x));

    const proof = tupleCV({
      "signers": tupleCV({
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
        "threshold": uintCV(1),
        "nonce": bufferFromHex("97550c84a9e30d01461a29ac1c54c29e82c1925ee78b2ee1776d9e20c0183334")
      }),
      "signatures": listCV([
        ...signatures.map(x => bufferFromHex(x))
      ])
    });


    const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(newSigners)), bufferCV(serializeCV(proof))], 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
  });
});

