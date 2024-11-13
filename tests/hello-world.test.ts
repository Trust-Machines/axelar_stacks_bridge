import { describe, expect, it } from "vitest";
import { deployGateway, gatewayImplCV, getSigners, makeProofCV, signersToCv } from "./util";
import { boolCV, bufferCV, cvToJSON, Cl, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV, contractPrincipalCV } from "@stacks/transactions";

import { keccak256 } from "./its-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("hello-world tests", () => {
  const sourceChain = stringAsciiCV("avalanche-fuji");
  const messageId = stringAsciiCV("0x896169e4ce82f5b90b1799cbf117b8f02ff8feebf80e853064826f3eeb25f433-0");
  const sourceAddress = stringAsciiCV("0xcE4103867CC4Bfb2382E6D0B7F88e6E3F8D563D6");
  const contractAddress = contractPrincipalCV(accounts.get("deployer")!, "hello-world");
  const payload = tupleCV({
    foo: stringAsciiCV("bar"),
    lorem: stringAsciiCV("ipsum")
  })
  const payloadHash = bufferCV(keccak256(serializeCV(payload)));

  const messages = listCV([
    tupleCV({
      "source-chain": sourceChain,
      "message-id": messageId,
      "source-address": sourceAddress,
      "contract-address": contractAddress,
      "payload-hash": payloadHash
    })
  ]);

  it("Should execute message", () => {
    const {result: impl} = simnet.callReadOnlyFn("gateway-storage", "get-impl", [], address1);
    expect(impl).toStrictEqual(gatewayImplCV);

    const proofSigners = deployGateway(getSigners(0, 10, 1, 4, "1"));

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

    // Approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(boolCV(true));

    // Execute on the hello world
    const { result: resultExecute } = simnet.callPublicFn("hello-world", "execute", [sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload)), gatewayImplCV], address1);
    expect(resultExecute).toBeOk(boolCV(true));
  });
});
