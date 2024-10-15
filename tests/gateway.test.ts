
import { boolCV, BufferCV, bufferCV, bufferCVFromString, cvToJSON, hash160, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { bufferFromAscii, bufferFromHex, deserialize, serialize } from "@stacks/transactions/dist/cl";
import { describe, expect, it } from "vitest";
import { SIGNER_KEYS, signMessageHashForAddress } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

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


const startGateway = () => {
  const signers = getSigners(0, 10, 1, 10, "1");
  const operator = principalCV(address1);
  const domainSeparator = bufferCVFromString('stacks-axelar-1');
  const minimumRotationDelay = uintCV(0);
  const previousSignersRetention = uintCV(15);

  expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signersToCv(signers))), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], address1).result).toBeOk(boolCV(true));

  return signers;
}

describe("Gateway tests", () => {

  it("Should revert all public functions before initialization", () => {
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
        "contract-address": bufferCVFromString("x"),
        "payload-hash": bufferCVFromString("y")
      })
    ]);

    // all public functions should revert before initialization
    // 4051 since signer-epoch is 0 by default
    expect(simnet.callPublicFn("gateway", "rotate-signers", [bufferCV(serializeCV(signersToCv(newSigners))), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(4051));
    // 6052
    expect(simnet.callPublicFn("gateway", "call-contract", [stringAsciiCV("foo"), stringAsciiCV("bar"), bufferFromAscii("baz")], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "approve-messages", [bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "validate-message", [stringAsciiCV("foo"), stringAsciiCV("bar"), stringAsciiCV("baz"), bufferFromAscii("x")], address1).result).toBeErr(uintCV(6052));
    expect(simnet.callPublicFn("gateway", "transfer-operatorship", [principalCV(address1)], address1).result).toBeErr(uintCV(6052));
  });


  it("Initialization", () => {
    const { result: getIsStarted1 } = simnet.callReadOnlyFn("gateway", "get-is-started", [], address1);
    expect(getIsStarted1).toBeBool(false);

    startGateway();

    // check init values 
    expect(simnet.callReadOnlyFn("gateway", "get-operator", [], address1).result).toBePrincipal(address1);
    expect(Buffer.from((simnet.callReadOnlyFn("gateway", "get-domain-separator", [], address1).result as BufferCV).buffer).toString("ascii")).toBe("stacks-axelar-1");
    expect(simnet.callReadOnlyFn("gateway", "get-minimum-rotation-delay", [], address1).result).toBeUint(0);
    expect(simnet.callReadOnlyFn("gateway", "get-previous-signers-retention", [], address1).result).toBeUint(15);
    expect(simnet.callReadOnlyFn("gateway", "get-is-started", [], address1).result).toBeBool(true);

    // already initialized
    // expect(simnet.callPublicFn("gateway", "setup", [bufferCV(serializeCV(signers)), operator, domainSeparator, minimumRotationDelay, previousSignersRetention], address1).result).toBeErr(uintCV(6051));
  });

  it("message-to-command-id", () => {
    expect(simnet.callReadOnlyFn("gateway", "message-to-command-id", [stringAsciiCV('Source'), stringAsciiCV('1')], address1).result).toBeBuff(bufferFromHex("0x908b3539125bd138ed0f374862a28328229fb1079bce40efdab1e52f89168fae").buffer)
  });

  it("call contract", () => {
    startGateway();

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


  it("Rotate signers", () => {
   

    const newSigners = getSigners(11, 15, 1, 3, "2")



    const proofSigners =  startGateway();

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

