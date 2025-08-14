import { boolCV, bufferCV, Cl, contractPrincipalCV, cvToJSON, listCV, serializeCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { keccak256 } from "./its-utils";
import { deployGateway, gatewayImplCV, getSigners, makeProofCV, signersToCv } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

let sourceChain = stringAsciiCV("ethereum");
let sourceAddress = stringAsciiCV("0xEde3d7425043a1e566D42DCfd6DBec8f2CFB81fB");

const setupGovernance = () => {
  const { result } = simnet.callPublicFn("governance", "setup", [sourceChain, sourceAddress], deployer);
  expect(result).toBeOk(boolCV(true));
}

describe("governance tests", () => {
  let eta = Math.floor(Date.now() / 1000) + 86400;

  let messageId = stringAsciiCV("1");
  let contractAddress = contractPrincipalCV(deployer, 'governance');

  it("should update gateway implementation", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'gateway-impl-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
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

    const { result: impl } = simnet.callReadOnlyFn("gateway-storage", "get-impl", [], address1);
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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gateway"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeOk(boolCV(true));

    // impl should be updated
    const { result: impl2 } = simnet.callReadOnlyFn("gateway-storage", "get-impl", [], address1);
    expect(impl2).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "gateway-impl-2"));
  });

  it("should update gateway governance", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'governance-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
      eta: uintCV(eta),
      type: uintCV(2)
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

    const proofSigners = deployGateway(getSigners(0, 10, 1, 4, "1"));

    const { result: impl } = simnet.callReadOnlyFn("gateway-storage", "get-owner", [], address1);
    expect(impl).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "governance"));

 

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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gateway"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeOk(boolCV(true));

    // impl should be updated
    const { result: impl2 } = simnet.callReadOnlyFn("gateway-storage", "get-owner", [], address1);
    expect(impl2).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "governance-2"));
  });

  it("should update interchain token factory implementation", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'interchain-token-factory-impl-2'),
      proxy: contractPrincipalCV(deployer, 'interchain-token-factory'),
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

    const { result: impl } = simnet.callReadOnlyFn("interchain-token-service-storage", "get-factory-impl", [], address1);
    expect(impl).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "interchain-token-factory-impl"));

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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "interchain-token-factory"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeOk(boolCV(true));

    // impl should be updated
    const { result: impl2 } = simnet.callReadOnlyFn("interchain-token-service-storage", "get-factory-impl", [], address1);
    expect(impl2).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "interchain-token-factory-impl-2"));
  });

  it("should update interchain token service implementation", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'interchain-token-service-impl-2'),
      proxy: contractPrincipalCV(deployer, 'interchain-token-service'),
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

    const { result: impl } = simnet.callReadOnlyFn("interchain-token-service-storage", "get-service-impl", [], address1);
    expect(impl).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "interchain-token-service-impl"));

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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "interchain-token-service"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeOk(boolCV(true));

    // impl should be updated
    const { result: impl2 } = simnet.callReadOnlyFn("interchain-token-service-storage", "get-service-impl", [], address1);
    expect(impl2).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "interchain-token-service-impl-2"));
  });

  it("should update gas service implementation", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'gas-impl-2'),
      proxy: contractPrincipalCV(deployer, 'gas-service'),
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

    const { result: impl } = simnet.callReadOnlyFn("gas-storage", "get-impl", [], address1);
    expect(impl).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "gas-impl"));

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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gas-service"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeOk(boolCV(true));

    // impl should be updated
    const { result: impl2 } = simnet.callReadOnlyFn("gas-storage", "get-impl", [], address1);
    expect(impl2).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "gas-impl-2"));
  });

  it("should not update with invalid proxy", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'gas-impl-2'),
      proxy: contractPrincipalCV(deployer, 'gas-service'),
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

    const { result: impl } = simnet.callReadOnlyFn("gas-storage", "get-impl", [], address1);
    expect(impl).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "gas-impl"));

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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // try to finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gateway"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeErr(uintCV(80006));
  });

  it("should cancel a scheduled task", () => {
    setupGovernance();

    //-- Schedule task 
    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'governance-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
      eta: uintCV(eta),
      type: uintCV(2)
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

    const proofSigners = deployGateway(getSigners(0, 10, 1, 4, "1"));
    
    const { result: impl } = simnet.callReadOnlyFn("gateway-storage", "get-owner", [], address1);
    expect(impl).toStrictEqual(contractPrincipalCV(accounts.get("deployer")!, "governance"));

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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    //-- Cancel task
    messageId = stringAsciiCV("2");

    const payload2 = tupleCV({
      hash: payloadHash,
      type: uintCV(3)
    });
    const payloadHash2 = bufferCV(keccak256(serializeCV(payload2)));

    const messages2 = listCV([
      tupleCV({
        "source-chain": sourceChain,
        "message-id": messageId,
        "source-address": sourceAddress,
        "contract-address": contractAddress,
        "payload-hash": payloadHash2
      })
    ]);

    const dataHash2 = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-messages", [messages2], address1);
      return cvToJSON(result).value;
    })();

    const messageHashToSign2 = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash2)], address1);
      return cvToJSON(result).value
    })();

    const proof2 = makeProofCV(proofSigners, messageHashToSign2);

    // approve message on the gateway
    const { result: resultApprove2 } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages2)), bufferCV(serializeCV(proof2))], address1);
    expect(resultApprove2).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute2 } = simnet.callPublicFn("governance", "cancel", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload2))], address1);
    expect(resultExecute2).toBeOk(boolCV(true));

    // check timelock. it should be deleted.
    const { result: timelock2 } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(cvToJSON(timelock2).value.eta.value).toBe('0')
  });

  it("should not finalize before eta", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'governance-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
      eta: uintCV(eta),
      type: uintCV(2)
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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    // should not finalize before eta
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gateway"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeErr(uintCV(80001));
  });

  it("should not finalize with invalid type", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'governance-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
      eta: uintCV(eta),
      type: uintCV(11)
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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeOk(boolCV(true));

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // should not finalize with invalid type
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gateway"), bufferCV(serializeCV(payload))], address1);
    expect(resultFinalize).toBeErr(uintCV(80005));
  });

  it("should revert with incorrect payload", () => {
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [contractPrincipalCV(accounts.get("deployer")!, "gateway"), bufferCV(serializeCV(tupleCV({ foo: stringAsciiCV("bar") })))], address1);
    expect(resultFinalize).toBeErr(uintCV(80002));
  });

  it("eta can't be smaller than min-eta", () => {
    setupGovernance();
    
    let eta = Math.floor(Date.now() / 1000) + 600;
    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'gateway-impl-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeErr(uintCV(80003));
  });

  it("should not run setup again", () => {
    setupGovernance();
    const { result } = simnet.callPublicFn("governance", "setup", [sourceChain, sourceAddress], deployer);
    expect(result).toBeErr(uintCV(80009));
  });

  it("should not setup from non-deployer", () => {
    const { result } = simnet.callPublicFn("governance", "setup", [sourceChain, sourceAddress], address1);
    expect(result).toBeErr(uintCV(80007));
  });

  it("should not execute before setup", () => {
    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'gateway-impl-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
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

    const { result: impl } = simnet.callReadOnlyFn("gateway-storage", "get-impl", [], address1);
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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // try to execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeErr(uintCV(80008));
  });

  it("should not execute with wrong source-chain/source-address", () => {
    setupGovernance();

    const payload = tupleCV({
      target: contractPrincipalCV(deployer, 'gateway-impl-2'),
      proxy: contractPrincipalCV(deployer, 'gateway'),
      eta: uintCV(eta),
      type: uintCV(1)
    })
    const payloadHash = bufferCV(keccak256(serializeCV(payload)));

    sourceChain = stringAsciiCV("thereum");
    sourceAddress = stringAsciiCV("0xEde3d7425043a1e566D42DCfd6DBec8f2CFB81fA");

    const messages = listCV([
      tupleCV({
        "source-chain": sourceChain,
        "message-id": messageId,
        "source-address": sourceAddress,
        "contract-address": contractAddress,
        "payload-hash": payloadHash
      })
    ]);

    const { result: impl } = simnet.callReadOnlyFn("gateway-storage", "get-impl", [], address1);
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

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, bufferCV(serializeCV(messages)), bufferCV(serializeCV(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

    // try to execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, bufferCV(serializeCV(payload))], address1);
    expect(resultExecute).toBeErr(uintCV(80007));
  });
});
