
import { describe, expect, it } from "vitest";
import { deployGateway, gatewayImplCV, getSigners, makeProofCV, signersToCv } from "./util";
import { boolCV, bufferCV, contractPrincipalCV, cvToJSON, Cl, listCV, principalCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";

import { keccak256 } from "./its-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("governance tests", () => {

  const eta = Math.floor(Date.now() / 1000) + 86400;
  const sourceChain = stringAsciiCV("Source");
  const messageId = stringAsciiCV("1");
  const sourceAddress = stringAsciiCV("address0x123");
  const contractAddress = principalCV(address1);
  const payload = tupleCV({
    target: contractPrincipalCV('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', 'gateway-impl'),
    eta: uintCV(eta),
    type: uintCV(1)
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

  it("Should update gateway implementation", () => {
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

    // Execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // Check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < eta) {
      simnet.mineBlock([]);
    }

    // Finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gateway"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeOk(boolCV(true));
  });
});
