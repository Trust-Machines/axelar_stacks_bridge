
import { boolCV, BufferCV, bufferCV, bufferCVFromString, cvToJSON, cvToValue, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromAscii, bufferFromHex } from "@stacks/transactions/dist/cl";
import { beforeEach, describe, expect, it } from "vitest";
import { contractCallEventToObj, getSigners, makeProofCV, messageApprovedEventToObj, messageExecutedEventToObj, SIGNER_KEYS, signersRotatedEventToObj, signersToCv, signMessageHashForAddress } from "./util";
import { Signers } from "./types";

const accounts = simnet.getAccounts();
const operator_address = accounts.get("wallet_1")!;
const contract_caller = accounts.get("wallet_2")!;

const startContract = (signers: Signers, minimumRotationDelay_: number = 0) => {
  const operator = principalCV(operator_address);
  const domainSeparator = bufferCVFromString('stacks-axelar-1');
  const minimumRotationDelay = uintCV(minimumRotationDelay_);
  const previousSignersRetention = uintCV(15);

  expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signersToCv(signers))), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], contract_caller).result).toBeOk(boolCV(true));

  return signers;
}

describe("Gateway tests", () => {

  it("should revert all public functions before initialization", () => {
    const newSigners = getSigners(0, 1, 1, 2, "1");
    const proofSigners = getSigners(0, 1, 1, 2, "1")

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
      return cvToJSON(result).value;
    })();

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
      return cvToJSON(result).value
    })();

    const proof = makeProofCV(proofSigners, messageHashToSign)

    const messages = listCV([
      tupleCV({
        "source-chain": stringAsciiCV("foo"),
        "message-id": stringAsciiCV("bar"),
        "source-address": stringAsciiCV("baz"),
        "contract-address": principalCV(operator_address),
        "payload-hash": bufferCVFromString("y")
      })
    ]);

    expect(simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "call-contract", [stringAsciiCV("foo"), stringAsciiCV("bar"), bufferFromAscii("baz")], contract_caller).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contract_caller).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "validate-message", [stringAsciiCV("foo"), stringAsciiCV("bar"), stringAsciiCV("baz"), bufferFromAscii("x")], contract_caller).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(operator_address)], contract_caller).result).toBeErr(uintCV(6052));
  });


  it("queries", () => {
    const { result: getIsStarted1 } = simnet.callReadOnlyFn("gateway", "get-is-started", [], contract_caller);
    expect(getIsStarted1).toBeBool(false);

    startContract(getSigners(0, 10, 1, 10, "1"));

    // check init values 
    expect(simnet.callReadOnlyFn("gateway", "get-operator", [], operator_address).result).toBePrincipal(operator_address);
    expect(Buffer.from((simnet.callReadOnlyFn("gateway", "get-domain-separator", [], contract_caller).result as BufferCV).buffer).toString("ascii")).toBe("stacks-axelar-1");
    expect(simnet.callReadOnlyFn("gateway", "get-minimum-rotation-delay", [], contract_caller).result).toBeUint(0);
    expect(simnet.callReadOnlyFn("gateway", "get-previous-signers-retention", [], contract_caller).result).toBeUint(15);
    expect(simnet.callReadOnlyFn("gateway", "get-is-started", [], contract_caller).result).toBeBool(true);
    expect(simnet.callReadOnlyFn("gateway", "message-to-command-id", [stringAsciiCV('Source'), stringAsciiCV('1')], contract_caller).result).toBeBuff(bufferFromHex("0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae").buffer);

    // already initialized
    // expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signers)), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], operator_address).result).toBeErr(uintCV(6051));
  });

  it("call contract", () => {
    startContract(getSigners(0, 10, 1, 10, "1"));

    const destinationChain = 'Destination';
    const destinationAddress = '0x123abc';
    const payload = operator_address;

    const { result, events } = simnet.callPublicFn("gateway", "call-contract", [stringAsciiCV(destinationChain), stringAsciiCV(destinationAddress), bufferCVFromString(payload)], contract_caller)
    expect(result).toBeOk(boolCV(true));
    expect(contractCallEventToObj(events[0].data.raw_value!)).toStrictEqual({
      type: 'contract-call',
      sender: contract_caller,
      destinationChain,
      destinationContractAddress: destinationAddress,
      payload: operator_address,
      payloadHash: '0x9ed02951dbf029855b46b102cc960362732569e83d00a49a7575d7aed229890e'
    });
  });

  describe("message validation", () => {
    const sourceChain = stringAsciiCV("Source");
    const messageId = stringAsciiCV("1");
    const sourceAddress = stringAsciiCV("address0x123");
    const contractAddress = principalCV(contract_caller);
    const payloadHash = bufferFromHex("0x373360faa7d5fc254d927e6aafe6127ec920f30efe61612b7ec6db33e72fb950");

    const messages = listCV([
      tupleCV({
        "source-chain": sourceChain,
        "message-id": messageId,
        "source-address": sourceAddress,
        "contract-address": contractAddress,
        "payload-hash": payloadHash
      })
    ]);

    it("should approve and validate message", () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-messages", [messages], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result: approveResult, events: approveEvents } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contract_caller);
      expect(approveResult).toBeOk(boolCV(true));
      expect(messageApprovedEventToObj(approveEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-approved',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
        sourceAddress: cvToValue(sourceAddress),
        contractAddress: cvToValue(contractAddress),
        payloadHash: cvToValue(payloadHash)
      });

      const isApprovedBefore = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));

      const isExecutedBefore = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], contract_caller);
      expect(validateResult).toBeOk(boolCV(true));
      expect(messageExecutedEventToObj(validateEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-executed',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
      });

      const isApprovedAfter = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // should not re-validate
      const { result: validateResult2 } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], contract_caller);
      expect(validateResult2).toBeErr(uintCV(9052));
    });


    it("reject re-approving a message", () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-messages", [messages], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result: approveResult, events: approveEvents } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contract_caller);
      expect(approveResult).toBeOk(boolCV(true));
      expect(messageApprovedEventToObj(approveEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-approved',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
        sourceAddress: cvToValue(sourceAddress),
        contractAddress: cvToValue(contractAddress),
        payloadHash: cvToValue(payloadHash)
      });

      const isApprovedBefore = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));

      const isExecutedBefore = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      // re-approval should be a no-op
      const { result: approveResult2, events: approveEvents2 } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contract_caller);
      expect(approveResult2).toBeOk(boolCV(true));
      expect(approveEvents2.length).toBe(0);

      const isApprovedBefore2 = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedBefore2).toBeOk(boolCV(true));

      const isExecutedBefore2 = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedBefore2).toBeOk(boolCV(false));

      // execute message
      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], contract_caller);
      expect(validateResult).toBeOk(boolCV(true));
      expect(messageExecutedEventToObj(validateEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-executed',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
      });

      const isApprovedAfter = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // re-approving same message after execution should be a no-op as well
      const { result: approveResult3, events: approveEvents3 } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contract_caller);
      expect(approveResult3).toBeOk(boolCV(true));
      expect(approveEvents3.length).toBe(0);

      const isApprovedAfter2 = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedAfter2).toBeOk(boolCV(false));

      const isExecutedAfter2 = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedAfter2).toBeOk(boolCV(true));
    });

  });


  describe("signer rotation", () => {
    it("should rotate signers", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result, events } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeOk(boolCV(true));
      expect(signersRotatedEventToObj(events[0].data.raw_value!)).toStrictEqual({
        type: 'signers-rotated',
        epoch: 2,
        signersHash: '0x7146e0383fc88d294cdfde2685895a88f56d34c46f3e2296c4b5293b22481d57',
        signers: newSigners
      });
    });

    it("reject rotating to the same signers", () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const newSigners = { ...proofSigners }

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeErr(uintCV(5054));
    });

    it("should reject rotating signers from an old signer set", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeOk(boolCV(true));

      const newSigners2 = getSigners(21, 30, 1, 3, "3");

      const dataHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners2)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash2)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof2 = makeProofCV(proofSigners, messageHashToSign2);

      const { result: result2 } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners2))), bufferCV(serializeCV(proof2))], contract_caller);
      expect(result2).toBeErr(uintCV(5055));
    });

    it("should allow rotating signers from an old signer set (called by the operator)", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeOk(boolCV(true));

      const newSigners2 = getSigners(21, 30, 1, 3, "3");

      const dataHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners2)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash2)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof2 = makeProofCV(proofSigners, messageHashToSign2);

      const { result: result2 } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners2))), bufferCV(serializeCV(proof2))], operator_address);
      expect(result2).toBeOk(boolCV(true));
    });


    it('should allow rotating signers after the delay', () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"), (10 * 60) + 1);

      simnet.mineBlock([]);

      const newSigners = getSigners(11, 15, 1, 3, "2")

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeOk(boolCV(true));
    });

    it('should reject rotating signers before the delay', () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"), (10 * 60) + 1);

      const newSigners = getSigners(11, 15, 1, 3, "2")

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeErr(uintCV(5051));
    });

    it('should allow rotating signers before the delay (called by the operator)', () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"), (10 * 60) + 1);

      const newSigners = getSigners(11, 15, 1, 3, "2")

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], operator_address);
      expect(result).toBeOk(boolCV(true));
    });

    it('should reject if there is no signer', () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(0, 0, 1, 3, "1");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeErr(uintCV(2051))
    });

    it('should reject if signer weight is 0', () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const newSigners: Signers = {
        signers: [
          {
            signer: '0277ad46cf1f82953116604c137c41d11fc095694d046417820a3d77253363b904',
            weight: 1
          },
          {
            signer: '031244d4c729f83c9e7898a85283e7460783a711746ba2ff24767443109ae1e64f',
            weight: 0
          },
          {
            signer: '03a59cff8eb6f7fd5972f24468e88ba23bd85960dfe0912c9434cabe92acf130d7',
            weight: 1
          },
          {
            signer: '0319ea093014a1cc7f4aa0219506c20bc1de1480ea157b9b28a088d5f8a70e63cb',
            weight: 1
          }
        ],
        threshold: 3,
        nonce: '1'
      }

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeErr(uintCV(2053));
    });
  });


  describe("Signature validation", () => {
    it('should reject invalid signatures ', () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(25, 30, 1, 3, "1");

      const proof = tupleCV({
        "signers": signersToCv(proofSigners),
        "signatures": listCV([
          ...proofSigners.signers.map(() => bufferFromHex("0x00"))
        ])
      });

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeErr(uintCV(3051));
    });


    it('should reject if there is signature with no match', () => {
      const proofSigners = startContract(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(25, 30, 1, 3, "1");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], contract_caller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], contract_caller);
        return cvToJSON(result).value
      })();

      const proof = tupleCV({
        "signers": signersToCv(proofSigners),
        "signatures": listCV([
          ...proofSigners.signers.map(() => bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), Object.keys(SIGNER_KEYS)[15])))
        ])
      });

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contract_caller);
      expect(result).toBeErr(uintCV(3053));
    });
  });

  describe("operatorship", () => {
    beforeEach(() => {
      startContract(getSigners(0, 10, 1, 10, "1"));
    })

    it("should allow transferring operatorship", () => {
      const { result } = simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(contract_caller)], operator_address);
      expect(result).toBeOk(boolCV(true));
    });

    it("should not allow transferring operatorship", () => {
      const { result } = simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(operator_address)], contract_caller);
      expect(result).toBeErr(uintCV(1051));
    });
  });
});


