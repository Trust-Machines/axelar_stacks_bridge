
import { boolCV, BufferCV, bufferCV, bufferCVFromString, cvToJSON, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromAscii, bufferFromHex, contractPrincipal, deserialize, uint } from "@stacks/transactions/dist/cl";
import { beforeEach, describe, expect, it } from "vitest";
import { SIGNER_KEYS, signMessageHashForAddress } from "./util";

const accounts = simnet.getAccounts();
const operator_address = accounts.get("wallet_1")!;
const contract_caller = accounts.get("wallet_2")!;

type Signers = {
  signers: {
    signer: string,
    weight: number
  }[],
  threshold: number,
  nonce: string
}

const signersToCv = (data: Signers) => {
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

const makeProofCV = (data: Signers, messageHashToSign: string) => {
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


const startContract = (minimumRotationDelay_: number = 0) => {
  const signers = getSigners(0, 10, 1, 10, "1");
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

    startContract();

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
    startContract();

    const destinationChain = 'Destination';
    const destinationAddress = '0x123abc';
    const payload = operator_address;

    const { result, events } = simnet.callPublicFn("gateway", "call-contract", [stringAsciiCV(destinationChain), stringAsciiCV(destinationAddress), bufferCVFromString(payload)], contract_caller)
    expect(result).toBeOk(boolCV(true));
    expect(events.length).toBe(1);
    const { value: js } = cvToJSON(deserialize(events[0].data.raw_value!));

    expect(js.sender.value).toBe(contract_caller);
    expect(js['destination-chain'].value).toBe(destinationChain);
    expect(js['destination-contract-address'].value).toBe(destinationAddress);
    expect(Buffer.from(bufferFromHex(js.payload.value).buffer).toString('ascii')).toBe(operator_address);
    expect(js['payload-hash'].value).toBe('0x9ed02951dbf029855b46b102cc960362732569e83d00a49a7575d7aed229890e');
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
      const proofSigners = startContract();

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
      expect(approveEvents).toMatchSnapshot();

      const isApprovedBefore = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));

      const isExecutedBefore = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], contract_caller);

      expect(validateResult).toBeOk(boolCV(true));
      expect(validateEvents).toMatchSnapshot();

      const isApprovedAfter = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // should not re-validate
      const { result: validateResult2 } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], contract_caller);
      expect(validateResult2).toBeErr(uintCV(9052));
    });

    it("reject re-approving a message", () => {
      const proofSigners = startContract();

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
      expect(approveEvents).toMatchSnapshot();

      const isApprovedBefore = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));

      const isExecutedBefore = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      // re-approval should be a no-op
      const { result: approveResult2, events: approveEvents2 } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contract_caller);
      expect(approveResult2).toBeOk(boolCV(true));
      expect(approveEvents2).toMatchSnapshot();

      const isApprovedBefore2 = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedBefore2).toBeOk(boolCV(true));

      const isExecutedBefore2 = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedBefore2).toBeOk(boolCV(false));

      // execute message
      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], contract_caller);
      expect(validateResult).toBeOk(boolCV(true));
      expect(validateEvents).toMatchSnapshot();

      const isApprovedAfter = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // re-approving same message after execution should be a no-op as well
      const { result: approveResult3, events: approveEvents3 } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contract_caller);
      expect(approveResult3).toBeOk(boolCV(true));
      expect(approveEvents3).toMatchSnapshot();

      const isApprovedAfter2 = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contract_caller).result;
      expect(isApprovedAfter2).toBeOk(boolCV(false));

      const isExecutedAfter2 = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], contract_caller).result;
      expect(isExecutedAfter2).toBeOk(boolCV(true));
    });
  });

  describe("signer rotation", () => {
    it("should rotate signers", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = startContract();

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
      expect(events).toMatchSnapshot();
    });

    it("reject rotating to the same signers", () => {
      const proofSigners = startContract();

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

      const proofSigners = startContract();

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

      const proofSigners = startContract();

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


    it('should allow rotating signers after the delay', async () => {
      const proofSigners = startContract((10 * 60) + 1);

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

    it('should reject rotating signers before the delay', async () => {
      const proofSigners = startContract((10 * 60) + 1);

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

    it('should allow rotating signers before the delay (called by the operator)', async () => {
      const proofSigners = startContract((10 * 60) + 1);

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
  });

  describe("operatorship", () => {
    beforeEach(() => {
      startContract();
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


