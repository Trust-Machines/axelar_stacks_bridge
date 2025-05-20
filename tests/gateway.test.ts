
import { boolCV, BufferCV, bufferCV, bufferCVFromString, Cl, contractPrincipalCV, cvToJSON, cvToValue, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { Signers } from "./types";
import { contractCaller, contractCallEventToObj, deployerAddress, deployGateway, gatewayImplCV, getSigners, makeProofCV, messageApprovedEventToObj, messageExecutedEventToObj, operatorAddress, SIGNER_KEYS, signersRotatedEventToObj, signersToCv, signMessageHashForAddress, transferOperatorshipEventToObj } from "./util";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;

describe("gateway tests", () => {

  it("should revert all public functions before initialization", () => {
    const newSigners = getSigners(0, 1, 1, 2, "1");
    const proofSigners = getSigners(0, 1, 1, 2, "1")

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
      return cvToJSON(result).value;
    })();

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
      return cvToJSON(result).value
    })();

    const proof = makeProofCV(proofSigners, messageHashToSign)

    const messages = listCV([
      tupleCV({
        "source-chain": stringAsciiCV("foo"),
        "message-id": stringAsciiCV("bar"),
        "source-address": stringAsciiCV("baz"),
        "contract-address": principalCV(operatorAddress),
        "payload-hash": bufferCVFromString("y")
      })
    ]);

    expect(simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller).result).toBeErr(uintCV(50000));
    expect(simnet.callPublicFn("gateway", "call-contract", [gatewayImplCV, stringAsciiCV("foo"), stringAsciiCV("bar"), Cl.bufferFromAscii("baz")], contractCaller).result).toBeErr(uintCV(50000));
    expect(simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contractCaller).result).toBeErr(uintCV(50000));
    expect(simnet.callPublicFn("gateway", "validate-message", [gatewayImplCV, stringAsciiCV("foo"), stringAsciiCV("bar"), stringAsciiCV("baz"), Cl.bufferFromAscii("x")], contractCaller).result).toBeErr(uintCV(50000));
    expect(simnet.callPublicFn("gateway", "transfer-operatorship", [gatewayImplCV, principalCV(operatorAddress)], contractCaller).result).toBeErr(uintCV(50000));
  });

  it("queries", () => {
    const { result: getIsStarted1 } = simnet.callReadOnlyFn("gateway-impl", "get-is-started", [], contractCaller);
    expect(getIsStarted1).toBeBool(false);

    deployGateway(getSigners(0, 10, 1, 10, "1"));

    // check init values 
    expect(simnet.callReadOnlyFn("gateway-impl", "get-operator", [], operatorAddress).result).toBePrincipal(operatorAddress);
    expect(Buffer.from((simnet.callReadOnlyFn("gateway-impl", "get-domain-separator", [], contractCaller).result as BufferCV).buffer).toString("ascii")).toBe("stacks-axelar-1");
    expect(simnet.callReadOnlyFn("gateway-impl", "get-minimum-rotation-delay", [], contractCaller).result).toBeUint(0);
    expect(simnet.callReadOnlyFn("gateway-impl", "get-previous-signers-retention", [], contractCaller).result).toBeUint(15);
    expect(simnet.callReadOnlyFn("gateway-impl", "get-is-started", [], contractCaller).result).toBeBool(true);
    expect(simnet.callReadOnlyFn("gateway-impl", "message-to-command-id", [stringAsciiCV('Source'), stringAsciiCV('1')], contractCaller).result).toBeBuff(Cl.bufferFromHex("0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae").buffer);
  });

  it("should not run setup func again", () => {
    deployGateway(getSigners(0, 10, 1, 10, "1"));
    const { result } = simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signersToCv(getSigners(0, 10, 1, 10, "2")))), principalCV(operatorAddress), bufferCVFromString('stacks-axelar-1'), uintCV(0), uintCV(0)], operatorAddress);
    expect(result).toBeErr(uintCV(70003));
  });

  it("only deployer can run the setup function", () => {
    const { result } = simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signersToCv(getSigners(0, 10, 1, 10, "2")))), principalCV(operatorAddress), bufferCVFromString('stacks-axelar-1'), uintCV(0), uintCV(0)], operatorAddress);
    expect(result).toBeErr(uintCV(70001));
  });

  it("call contract", () => {
    deployGateway(getSigners(0, 10, 1, 10, "1"));

    const destinationChain = 'Destination';
    const destinationAddress = '0x123abc';
    const payload = operatorAddress;

    const { result, events } = simnet.callPublicFn("gateway", "call-contract", [gatewayImplCV, stringAsciiCV(destinationChain), stringAsciiCV(destinationAddress), bufferCVFromString(payload)], contractCaller)
    expect(result).toBeOk(boolCV(true));
    expect(events[0].data.contract_identifier).toBe(`${deployer}.gateway-storage`);
    expect(contractCallEventToObj(events[0].data.raw_value!)).toStrictEqual({
      type: 'contract-call',
      sender: contractCaller,
      destinationChain,
      destinationContractAddress: destinationAddress,
      payload: operatorAddress,
      payloadHash: '0x9ed02951dbf029855b46b102cc960362732569e83d00a49a7575d7aed229890e'
    });
  });

  describe("message validation", () => {
    const sourceChain = stringAsciiCV("Source");
    const messageId = stringAsciiCV("1");
    const sourceAddress = stringAsciiCV("address0x123");
    const contractAddress = principalCV(contractCaller);
    const payloadHash = Cl.bufferFromHex("0x373360faa7d5fc254d927e6aafe6127ec920f30efe61612b7ec6db33e72fb950");

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
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-messages", [messages], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result: approveResult, events: approveEvents } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contractCaller);
      expect(approveResult).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));
      expect(approveEvents[0].data.contract_identifier).toBe(`${deployer}.gateway-storage`)
      expect(messageApprovedEventToObj(approveEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-approved',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
        sourceAddress: cvToValue(sourceAddress),
        contractAddress: cvToValue(contractAddress),
        payloadHash: cvToValue(payloadHash)
      });

      const isApprovedBefore = simnet.callReadOnlyFn("gateway-impl", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contractCaller).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));

      const isExecutedBefore = simnet.callReadOnlyFn("gateway-impl", "is-message-executed", [sourceChain, messageId], contractCaller).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [gatewayImplCV, sourceChain, messageId, sourceAddress, payloadHash], contractCaller);
      expect(validateResult).toBeOk(boolCV(true));
      expect(approveEvents[0].data.contract_identifier).toBe(`${deployer}.gateway-storage`)
      expect(messageExecutedEventToObj(validateEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-executed',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
      });

      const isApprovedAfter = simnet.callReadOnlyFn("gateway-impl", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contractCaller).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway-impl", "is-message-executed", [sourceChain, messageId], contractCaller).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // should not re-validate executed message
      const { result: validateResult2 } = simnet.callPublicFn("gateway", "validate-message", [gatewayImplCV, sourceChain, messageId, sourceAddress, payloadHash], contractCaller);
      expect(validateResult2).toBeErr(uintCV(50019));

      // should not re-validate with invalid message id
      const messageId2 = stringAsciiCV("11");
      const { result: validateResult3 } = simnet.callPublicFn("gateway", "validate-message", [gatewayImplCV, sourceChain, messageId2, sourceAddress, payloadHash], contractCaller);
      expect(validateResult3).toBeErr(uintCV(50004));
    });


    it("reject re-approving a message", () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-messages", [messages], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result: approveResult, events: approveEvents } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contractCaller);
      expect(approveResult).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));
      expect(approveEvents[0].data.contract_identifier).toBe(`${deployer}.gateway-storage`)
      expect(messageApprovedEventToObj(approveEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-approved',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
        sourceAddress: cvToValue(sourceAddress),
        contractAddress: cvToValue(contractAddress),
        payloadHash: cvToValue(payloadHash)
      });

      const isApprovedBefore = simnet.callReadOnlyFn("gateway-impl", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contractCaller).result;
      expect(isApprovedBefore).toBeOk(boolCV(true));

      const isExecutedBefore = simnet.callReadOnlyFn("gateway-impl", "is-message-executed", [sourceChain, messageId], contractCaller).result;
      expect(isExecutedBefore).toBeOk(boolCV(false));

      // re-approval should be a no-op
      const { result: approveResult2, events: approveEvents2 } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contractCaller);
      expect(approveResult2).toBeOk(Cl.list([Cl.ok(Cl.bool(false))]));
      expect(approveEvents2.length).toBe(0);

      const isApprovedBefore2 = simnet.callReadOnlyFn("gateway-impl", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contractCaller).result;
      expect(isApprovedBefore2).toBeOk(boolCV(true));

      const isExecutedBefore2 = simnet.callReadOnlyFn("gateway-impl", "is-message-executed", [sourceChain, messageId], contractCaller).result;
      expect(isExecutedBefore2).toBeOk(boolCV(false));

      // execute message
      const { result: validateResult, events: validateEvents } = simnet.callPublicFn("gateway", "validate-message", [gatewayImplCV, sourceChain, messageId, sourceAddress, payloadHash], contractCaller);
      expect(validateResult).toBeOk(boolCV(true));
      expect(approveEvents[0].data.contract_identifier).toBe(`${deployer}.gateway-storage`)
      expect(messageExecutedEventToObj(validateEvents[0].data.raw_value!)).toStrictEqual({
        type: 'message-executed',
        commandId: '0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae',
        sourceChain: cvToValue(sourceChain),
        messageId: cvToValue(messageId),
      });

      const isApprovedAfter = simnet.callReadOnlyFn("gateway-impl", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contractCaller).result;
      expect(isApprovedAfter).toBeOk(boolCV(false));

      const isExecutedAfter = simnet.callReadOnlyFn("gateway-impl", "is-message-executed", [sourceChain, messageId], contractCaller).result;
      expect(isExecutedAfter).toBeOk(boolCV(true));

      // re-approving same message after execution should be a no-op as well
      const { result: approveResult3, events: approveEvents3 } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], contractCaller);
      expect(approveResult3).toBeOk(Cl.list([Cl.ok(Cl.bool(false))]));
      expect(approveEvents3.length).toBe(0);

      const isApprovedAfter2 = simnet.callReadOnlyFn("gateway-impl", "is-message-approved", [sourceChain, messageId, sourceAddress, contractAddress, payloadHash], contractCaller).result;
      expect(isApprovedAfter2).toBeOk(boolCV(false));

      const isExecutedAfter2 = simnet.callReadOnlyFn("gateway-impl", "is-message-executed", [sourceChain, messageId], contractCaller).result;
      expect(isExecutedAfter2).toBeOk(boolCV(true));
    });

  });

  describe("signer rotation", () => {
    it("should rotate signers", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result, events } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeOk(boolCV(true));
      expect(events[0].data.contract_identifier).toBe(`${deployer}.gateway-storage`)
      expect(signersRotatedEventToObj(events[0].data.raw_value!)).toStrictEqual({
        type: 'signers-rotated',
        epoch: 2,
        signersHash: '0x3f89f80b758e2c80e86ec29e0cec2007286d0269cc85007a34e1dcf404197f53',
        signers: newSigners
      });
    });

    it("reject rotating to the same signers", () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners = { ...proofSigners }

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50017));
    });

    it("should reject rotating signers from an old signer set", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeOk(boolCV(true));

      const newSigners2 = getSigners(21, 30, 1, 3, "3");

      const dataHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners2)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash2)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof2 = makeProofCV(proofSigners, messageHashToSign2);

      const { result: result2 } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners2))), bufferCV(serializeCV(proof2))], contractCaller);
      expect(result2).toBeErr(uintCV(50018));
    });

    it("should allow rotating signers from an old signer set (called by the operator)", () => {
      const newSigners = getSigners(11, 15, 1, 3, "2")

      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeOk(boolCV(true));

      const newSigners2 = getSigners(21, 30, 1, 3, "3");

      const dataHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners2)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash2)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof2 = makeProofCV(proofSigners, messageHashToSign2);

      const { result: result2 } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners2))), bufferCV(serializeCV(proof2))], operatorAddress);
      expect(result2).toBeOk(boolCV(true));
    });

    it('should allow rotating signers after the delay', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"), { minimumRotationDelay: (10 * 60) + 1 });

      simnet.mineEmptyBlocks(6);

      const newSigners = getSigners(11, 15, 1, 3, "2")

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeOk(boolCV(true));
    });

    it('should reject rotating signers before the delay', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"), { minimumRotationDelay: (10 * 60) + 1 });

      const newSigners = getSigners(11, 15, 1, 3, "2")

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50014));
    });

    it('should allow rotating signers before the delay (called by the operator)', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"), { minimumRotationDelay: (10 * 60) + 1 });

      const newSigners = getSigners(11, 15, 1, 3, "2")

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], operatorAddress);
      expect(result).toBeOk(boolCV(true));
    });
  });


  describe("signer validation", () => {

    it('should reject if there is no signer', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(0, 0, 1, 3, "1");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50006))
    });

    it('should reject if signer weight is 0', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners: Signers = {
        signers: [
          {
            signer: '020544a6b1e14d0563e50bfbfdde11fdae17eac04d95bee50e595e6d80ea0a932b',
            weight: 1
          },
          {
            signer: '020efaddd546e33405db1fccd46610c30012f59137874d658c0315b910bf8793e5',
            weight: 0
          },
          {
            signer: '0215049277b2681c5a10f0dc93c67203ac3b865adfaf8d8d6d75df65082f3676e9',
            weight: 1
          },
          {
            signer: '0220ceccbc486f0bf0722150d02bbde9a4d688707148d911b85decac66b88fd374',
            weight: 1
          }
        ],
        threshold: 3,
        nonce: '2'
      }

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50007));
    });

    it('should reject if signers are not ordered', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners: Signers = {
        signers: [
          {
            signer: '020544a6b1e14d0563e50bfbfdde11fdae17eac04d95bee50e595e6d80ea0a932b',
            weight: 1
          },
          {
            signer: '0215049277b2681c5a10f0dc93c67203ac3b865adfaf8d8d6d75df65082f3676e9',
            weight: 1
          },
          {
            signer: '020efaddd546e33405db1fccd46610c30012f59137874d658c0315b910bf8793e5',
            weight: 1
          },
          {
            signer: '0220ceccbc486f0bf0722150d02bbde9a4d688707148d911b85decac66b88fd374',
            weight: 1
          }
        ],
        threshold: 3,
        nonce: '2'
      }

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50008));
    });

    it('should reject if threshold is 0', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));
      const newSigners = getSigners(10, 15, 1, 0, "2");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50009));
    });

    it('should reject if total weight is lowet than threshold', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));
      const newSigners = getSigners(10, 15, 1, 6, "2");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50010));
    });
  });


  describe("signature validation", () => {
    it('should reject invalid signatures ', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(25, 30, 1, 3, "1");

      const proof = tupleCV({
        "signers": signersToCv(proofSigners),
        "signatures": listCV([
          ...proofSigners.signers.map(() => Cl.bufferFromHex("0x00"))
        ])
      });

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50011));
    });


    it('should reject if signers are not in strictly increasing order', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(25, 30, 1, 3, "1");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = tupleCV({
        "signers": signersToCv(proofSigners),
        "signatures": listCV([
          ...proofSigners.signers.map(() => Cl.bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), Object.keys(SIGNER_KEYS)[15])))
        ])
      });

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50008));
    });

    it('should reject if not enough weight provided ', () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(25, 30, 1, 3, "1");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = tupleCV({
        "signers": signersToCv(proofSigners),
        "signatures": listCV([
          ...proofSigners.signers.slice(0, 9).map((x) => Cl.bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), x.signer)))
        ])
      });

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50012));
    });

    it('should reject if same signature provided more than once', () => {
      const proofSigners: Signers = {
        signers: [
          {
            signer: '020544a6b1e14d0563e50bfbfdde11fdae17eac04d95bee50e595e6d80ea0a932b',
            weight: 1
          },
          {
            signer: '020efaddd546e33405db1fccd46610c30012f59137874d658c0315b910bf8793e5',
            weight: 1
          },
          {
            signer: '0215049277b2681c5a10f0dc93c67203ac3b865adfaf8d8d6d75df65082f3676e9',
            weight: 1
          },
          {
            signer: '0220ceccbc486f0bf0722150d02bbde9a4d688707148d911b85decac66b88fd374',
            weight: 1
          }
        ],
        threshold: 3,
        nonce: '2'
      }

      deployGateway(proofSigners);

      const newSigners = getSigners(10, 20, 1, 6, "2");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = tupleCV({
        "signers": signersToCv(proofSigners),
        "signatures": listCV([
          Cl.bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), proofSigners.signers[0].signer)),
          Cl.bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), proofSigners.signers[1].signer)),
          Cl.bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), proofSigners.signers[1].signer))
        ])
      });

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeErr(uintCV(50008));
    });
  });


  describe("proof validation", () => {
    it("should allow rotating signers from operator with a previous proof", () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"));

      const newSigners = getSigners(11, 15, 1, 3, "2");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeOk(boolCV(true));

      // -------------

      const newSigners2 = getSigners(22, 30, 1, 3, "3")

      const signersHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners2)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash2), Cl.bufferFromHex(dataHash2)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof2 = makeProofCV(proofSigners, messageHashToSign2);

      const { result: result2 } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners2))), bufferCV(serializeCV(proof2))], operatorAddress);
      expect(result2).toBeOk(boolCV(true));
    });

    it('Arbitrary users cannot rotate signers', () => {

      // Valid signer data, 2 signers
      const proofSigners: Signers = {
        signers: [
          {
            signer: '020544a6b1e14d0563e50bfbfdde11fdae17eac04d95bee50e595e6d80ea0a932b',
            weight: 1
          },
          {
            signer: '020efaddd546e33405db1fccd46610c30012f59137874d658c0315b910bf8793e5',
            weight: 1
          }
        ],
        threshold: 2,
        nonce: '2'
      }
  
      // 2 other, random, malicious signers
      const badSigners = [
        '0215049277b2681c5a10f0dc93c67203ac3b865adfaf8d8d6d75df65082f3676e9',
        '0220ceccbc486f0bf0722150d02bbde9a4d688707148d911b85decac66b88fd374',
      ];
  
      // Gateway is deployed with the valid signers
      deployGateway(proofSigners);
  
      // malicious signers are designated
      const maliciousSigners = getSigners(10, 20, 1, 6, "2");
  
      // the current signer hash is calculated 
      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();
  
      // the data hash, with the new malicious signers, is calculated
      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(maliciousSigners)], contractCaller);
        return cvToJSON(result).value;
      })();
  
      // the message to sign, which results in signers rotation to the new, malicious set
      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();
  
      // Attacker creates the malicious proof where the original signers are set but the signatures
      // are made and signed by them
      const maliciousProof = tupleCV({
        "signers": signersToCv(proofSigners),
        "signatures": listCV([
          Cl.bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), badSigners[0])),
          Cl.bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), badSigners[1])),
        ])
      });
  
      // show that the rotation fails
      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(maliciousSigners))), bufferCV(serializeCV(maliciousProof))], contractCaller);
      expect(result).toBeErr(Cl.uint(50013));
    });

    it("should reject rotating signers from operator with a previous proof", () => {
      const proofSigners = deployGateway(getSigners(0, 10, 1, 10, "1"), { previousSignersRetention: 0 });

      const newSigners = getSigners(11, 15, 1, 3, "2");

      const signersHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof = makeProofCV(proofSigners, messageHashToSign);

      const { result } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], contractCaller);
      expect(result).toBeOk(boolCV(true));

      // -------------

      const newSigners2 = getSigners(22, 30, 1, 3, "3")

      const signersHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], contractCaller);
        return cvToJSON(result).value;
      })();

      const dataHash2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-signers", [signersToCv(newSigners2)], contractCaller);
        return cvToJSON(result).value;
      })();

      const messageHashToSign2 = (() => {
        const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash2), Cl.bufferFromHex(dataHash2)], contractCaller);
        return cvToJSON(result).value
      })();

      const proof2 = makeProofCV(proofSigners, messageHashToSign2);

      const { result: result2 } = simnet.callPublicFn("gateway", "rotate-signers", [gatewayImplCV, bufferCV(serializeCV(signersToCv(newSigners2))), bufferCV(serializeCV(proof2))], operatorAddress);
      expect(result2).toBeErr(uintCV(50013));
    });
  });

  describe("gateway proxy calls", () => {
    it("should validate impl address", () => {
      expect(simnet.callPublicFn("gateway", "call-contract", [contractPrincipalCV(deployerAddress, "traits"), stringAsciiCV("foo"), stringAsciiCV("bar"), Cl.bufferFromAscii("baz")], contractCaller).result).toBeErr(uintCV(70000));
      expect(simnet.callPublicFn("gateway", "approve-messages", [contractPrincipalCV(deployerAddress, "traits"), Cl.bufferFromHex("0x00"), Cl.bufferFromHex("0x00")], contractCaller).result).toBeErr(uintCV(70000));
      expect(simnet.callPublicFn("gateway", "validate-message", [contractPrincipalCV(deployerAddress, "traits"), stringAsciiCV(""), stringAsciiCV(""), stringAsciiCV(""), Cl.bufferFromHex("0x00")], contractCaller).result).toBeErr(uintCV(70000));
      expect(simnet.callPublicFn("gateway", "rotate-signers", [contractPrincipalCV(deployerAddress, "traits"), Cl.bufferFromHex("0x00"), Cl.bufferFromHex("0x00")], contractCaller).result).toBeErr(uintCV(70000));
      expect(simnet.callPublicFn("gateway", "transfer-operatorship", [contractPrincipalCV(deployerAddress, "traits"), principalCV(contractCaller)], contractCaller).result).toBeErr(uintCV(70000));
      expect(simnet.callPublicFn("gateway", "call", [contractPrincipalCV(deployerAddress, "traits"), stringAsciiCV("foo"), Cl.bufferFromHex("0x00")], contractCaller).result).toBeErr(uintCV(70000));
    });

    it("dynamic dispatch", () => {
      deployGateway(getSigners(0, 10, 1, 10, "1"));
      const { result } = simnet.callPublicFn("gateway", "call", [gatewayImplCV, stringAsciiCV("foo"), Cl.bufferFromHex("0x00")], contractCaller);
      expect(result).toBeErr(uintCV(50002));
    });
  });

  describe("governance only calls", () => {
    it("should be blocked", () => {
      expect(simnet.callPublicFn("gateway", "set-impl", [principalCV(contractCaller)], contractCaller).result).toBeErr(uintCV(70001));
      expect(simnet.callPublicFn("gateway", "set-governance", [principalCV(contractCaller)], contractCaller).result).toBeErr(uintCV(70001));
    });
  });

  describe("operatorship", () => {
    it("should allow transferring operatorship", () => {
      deployGateway(getSigners(0, 10, 1, 10, "1"));
      const { result, events } = simnet.callPublicFn("gateway", "transfer-operatorship", [gatewayImplCV, principalCV(contractCaller)], operatorAddress);
      expect(result).toBeOk(boolCV(true));
      expect(events[0].data.contract_identifier).toBe(`${deployer}.gateway-storage`)
      expect(transferOperatorshipEventToObj(events[0].data.raw_value!)).toStrictEqual({
        type: 'transfer-operatorship',
        newOperator: contractCaller
      });
    });

    it("should not allow transferring operatorship", () => {
      deployGateway(getSigners(0, 10, 1, 10, "1"));
      const { result } = simnet.callPublicFn("gateway", "transfer-operatorship", [gatewayImplCV, principalCV(operatorAddress)], contractCaller);
      expect(result).toBeErr(uintCV(50006));
    });
  });
});


