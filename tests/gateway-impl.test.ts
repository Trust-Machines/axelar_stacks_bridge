
import { boolCV, bufferCV, cvToJSON, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV, Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { deployGateway, getSigners, makeProofCV, signersToCv } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("gateway impl tests", () => {
  it("proxy only public functions", () => {
    expect(simnet.callPublicFn("gateway-impl", "call-contract", [stringAsciiCV("foo"), stringAsciiCV("bar"), Cl.bufferFromAscii("baz"), principalCV(address1)], address1).result).toBeErr(uintCV(50001));
    expect(simnet.callPublicFn("gateway-impl", "validate-message", [stringAsciiCV(""), stringAsciiCV(""), stringAsciiCV(""), Cl.bufferFromHex("0x00"), principalCV(address1)], address1).result).toBeErr(uintCV(50001));
    expect(simnet.callPublicFn("gateway-impl", "transfer-operatorship", [principalCV(address1), principalCV(address1)], address1).result).toBeErr(uintCV(50001));
    expect(simnet.callPublicFn("gateway-impl", "rotate-signers-inner", [tupleCV({ "signers": listCV([]), "threshold": uintCV(1), "nonce": Cl.bufferFromHex("0x00") }), boolCV(false)], address1).result).toBeErr(uintCV(50001));
    expect(simnet.callPublicFn("gateway-impl", "dispatch", [stringAsciiCV(""), Cl.bufferFromHex("0x00")], address1).result).toBeErr(uintCV(50001));
  });

  it("proxy only public functions (approve-messages)", () => {
    const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

    const messages = listCV([
      tupleCV({
        "source-chain": stringAsciiCV("Source"),
        "message-id": stringAsciiCV("1"),
        "source-address": stringAsciiCV("address0x123"),
        "contract-address": principalCV(address1),
        "payload-hash": Cl.bufferFromHex("0x373360faa7d5fc254d927e6aafe6127ec920f30efe61612b7ec6db33e72fb950")
      })
    ]);

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], address1);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-messages", [messages], address1);
      return cvToJSON(result).value;
    })();

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], address1);
      return cvToJSON(result).value
    })();

    const proof = makeProofCV(proofSigners, messageHashToSign);

    expect(simnet.callPublicFn("gateway-impl", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(50001));
  });

  it("proxy only public functions (rotate-signers)", () => {
    const newSigners = getSigners(11, 15, 1, 3, "2")

    const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], address1);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], address1);
      return cvToJSON(result).value;
    })();

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], address1);
      return cvToJSON(result).value
    })();

    const proof = makeProofCV(proofSigners, messageHashToSign);

    expect(simnet.callPublicFn("gateway-impl", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(50001));
  });
});
