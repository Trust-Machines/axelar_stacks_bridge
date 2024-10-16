
import { boolCV, BufferCV, bufferCV, bufferCVFromString, cvToJSON, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromAscii, bufferFromHex, contractPrincipal, deserialize } from "@stacks/transactions/dist/cl";
import { beforeEach, describe, expect, it } from "vitest";
import { SIGNER_KEYS, signMessageHashForAddress } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;

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


const startContract = () => {
  const signers = getSigners(0, 10, 1, 10, "1");
  const operator = principalCV(address1);
  const domainSeparator = bufferCVFromString('stacks-axelar-1');
  const minimumRotationDelay = uintCV(0);
  const previousSignersRetention = uintCV(15);

  expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signersToCv(signers))), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], address1).result).toBeOk(boolCV(true));

  return signers;
}

describe("Gateway tests", () => {

  it("should revert all public functions before initialization", () => {
    const newSigners = getSigners(0, 1, 1, 2, "1");
    const proofSigners = getSigners(0, 1, 1, 2, "1")

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], address1);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], address1);
      return cvToJSON(result).value;
    })();

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], address1);
      return cvToJSON(result).value
    })();

    const proof = makeProofCV(proofSigners, messageHashToSign)

    const messages = listCV([
      tupleCV({
        "source-chain": stringAsciiCV("foo"),
        "message-id": stringAsciiCV("bar"),
        "source-address": stringAsciiCV("baz"),
        "contract-address": principalCV(address1),
        "payload-hash": bufferCVFromString("y")
      })
    ]);

    expect(simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "call-contract", [stringAsciiCV("foo"), stringAsciiCV("bar"), bufferFromAscii("baz")], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "validate-message", [stringAsciiCV("foo"), stringAsciiCV("bar"), stringAsciiCV("baz"), bufferFromAscii("x")], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(address1)], address1).result).toBeErr(uintCV(6052));
  });


  it("queries", () => {
    const { result: getIsStarted1 } = simnet.callReadOnlyFn("gateway", "get-is-started", [], address1);
    expect(getIsStarted1).toBeBool(false);

    startContract();

    // check init values 
    expect(simnet.callReadOnlyFn("gateway", "get-operator", [], address1).result).toBePrincipal(address1);
    expect(Buffer.from((simnet.callReadOnlyFn("gateway", "get-domain-separator", [], address1).result as BufferCV).buffer).toString("ascii")).toBe("stacks-axelar-1");
    expect(simnet.callReadOnlyFn("gateway", "get-minimum-rotation-delay", [], address1).result).toBeUint(0);
    expect(simnet.callReadOnlyFn("gateway", "get-previous-signers-retention", [], address1).result).toBeUint(15);
    expect(simnet.callReadOnlyFn("gateway", "get-is-started", [], address1).result).toBeBool(true);
    expect(simnet.callReadOnlyFn("gateway", "message-to-command-id", [stringAsciiCV('Source'), stringAsciiCV('1')], address1).result).toBeBuff(bufferFromHex("0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae").buffer);

    // already initialized
    // expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signers)), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], address1).result).toBeErr(uintCV(6051));
  });

  it("call contract", () => {
    startContract();

    const destinationChain = 'Destination';
    const destinationAddress = '0x123abc';
    const payload = address1;

    const { result, events } = simnet.callPublicFn("gateway", "call-contract", [stringAsciiCV(destinationChain), stringAsciiCV(destinationAddress), bufferCVFromString(payload)], address1)
    expect(result).toBeOk(boolCV(true));
    expect(events.length).toBe(1);
    const { value: js } = cvToJSON(deserialize(events[0].data.raw_value!));

    expect(js.sender.value).toBe(address1);
    expect(js['destination-chain'].value).toBe(destinationChain);
    expect(js['destination-contract-address'].value).toBe(destinationAddress);
    expect(Buffer.from(bufferFromHex(js.payload.value).buffer).toString('ascii')).toBe(address1);
    expect(js['payload-hash'].value).toBe('0x9ed02951dbf029855b46b102cc960362732569e83d00a49a7575d7aed229890e');
  });

  describe("signer rotation", () => {
    it("should rotate signers", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = startContract();

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], address1);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-signers", [signersToCv(newSigners)], address1);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], address1);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign)

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], address1);
      expect(result).toBeOk(boolCV(true));
    });
  });

  describe("message validation", () => {
    const sourceChain = stringAsciiCV("Source");
    const messageId = stringAsciiCV("1");
    const sourceAddress = stringAsciiCV("address0x123");
    const contractAddress = principalCV(address1);
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
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], address1);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-messages", [messages], address1);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], address1);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result: approveResult, events: approveEvents } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);

      expect(approveResult).toBeOk(boolCV(true));
      expect(approveEvents).toMatchSnapshot();

      const isApprovedBefore = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], address1).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));

      const isExecutedBefore = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], address1).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], address1);

      expect(validateResult).toBeOk(boolCV(true));
      expect(validateEvents).toMatchSnapshot();

      const isApprovedAfter = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], address1).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], address1).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // should not re-validate
      const { result: validateResult2 } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], address1);
      expect(validateResult2).toBeErr(uintCV(9052));
    });

    it("reject re-approving a message", () => {
      const proofSigners = startContract();

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "get-signers-hash", [signersToCv(proofSigners)], address1);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "data-hash-from-messages", [messages], address1);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway", "message-hash-to-sign", [bufferFromHex(signersHash), bufferFromHex(dataHash)], address1);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result: approveResult, events: approveEvents } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
      expect(approveResult).toBeOk(boolCV(true));
      expect(approveEvents).toMatchSnapshot();

      const isApprovedBefore = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], address1).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));
      
      const isExecutedBefore = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], address1).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      // re-approval should be a no-op
      const { result: approveResult2, events: approveEvents2 } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
      expect(approveResult2).toBeOk(boolCV(true));
      expect(approveEvents2).toMatchSnapshot();

      const isApprovedBefore2 = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], address1).result;
      expect(isApprovedBefore2).toBeOk(boolCV(true));

      const isExecutedBefore2 = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], address1).result;
      expect(isExecutedBefore2).toBeOk(boolCV(false));

      // execute message
      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [sourceChain, messageId, sourceAddress, payloadHash], address1);
      expect(validateResult).toBeOk(boolCV(true));
      expect(validateEvents).toMatchSnapshot();

      const isApprovedAfter = simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], address1).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], address1).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // re-approving same message after execution should be a no-op as well
      const { result: approveResult3, events: approveEvents3 } = simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
      expect(approveResult3).toBeOk(boolCV(true));
      expect(approveEvents3).toMatchSnapshot();

      const isApprovedAfter2= simnet.callReadOnlyFn("gateway", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], address1).result;
      expect(isApprovedAfter2).toBeOk(boolCV(false));

      const isExecutedAfter2 = simnet.callReadOnlyFn("gateway", "is-message-executed", [sourceChain, messageId], address1).result;
      expect(isExecutedAfter2).toBeOk(boolCV(true));
    });
  });

  describe("operatorship", () => {
    beforeEach(() => {
      startContract();
    })

    it("should allow transferring operatorship", () => {
      const { result } = simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(address2)], address1);
      expect(result).toBeOk(boolCV(true));
    });

    it("should not allow transferring operatorship", () => {
      const { result } = simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(address1)], address2);
      expect(result).toBeErr(uintCV(1051));
    });
  });
});


