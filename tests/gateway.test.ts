
import { cvToJSON, listCV, principalCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { describe, expect, it } from "vitest";
import { signMessageHashForAddress } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

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

    const proofSigners =  tupleCV({
      "signers": listCV([
        tupleCV({
          "signer": principalCV('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'),
          "weight": uintCV(1)
        })
      ]),
      "threshold": uintCV(1),
      "nonce": bufferFromHex("97550c84a9e30d01461a29ac1c54c29e82c1925ee78b2ee1776d9e20c0183334")
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
    expect(dataHash).toEqual("0x56b1d353ae2b681305d53391e1942d6d25265ed76646dbbcbcb7b44366cac180");

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

    expect(messageHashToSign).toEqual("0x4dffe5e28bc735ae453fee24cc6b334aeed63691d57e533abd39a2714f6ec33a");

    // const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(newSigners)), bufferCV(serializeCV(proof))], 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    // console.log(result)
  });
});

