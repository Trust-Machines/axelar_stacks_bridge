import { Cl, cvToJSON } from "@stacks/transactions";
import { keccak256 } from "./its-utils";
import {
  deployGateway,
  gatewayImplCV,
  getSigners,
  makeProofCV,
  signersToCv,
} from "./util";
import { expect } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;

export function upgradeITSBasedContract(suffix: string) {
  let eta = Math.floor(Date.now() / 1000) + 86400;
  let sourceChain = Cl.stringAscii("Source");
  let messageId = Cl.stringAscii("1");
  let sourceAddress = Cl.stringAscii("address0x123");
  let contractAddress = Cl.contractPrincipal(
    "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    "governance",
  );

  const scope = "interchain-token";
  const prefix = `${scope}-${suffix}`;

  const currentImpl = `${prefix}-impl`;
  const currentImplCA = `${deployer}.${currentImpl}`;
  const newImpl = `${prefix}-impl-2`;
  const newImplCA = `${address2}.${newImpl}`;
  const itsImplCode = simnet
    .getContractSource(`${prefix}-impl`)!
    .replace(/ \./g, ` '${deployer}.`);

  simnet.deployContract(newImpl, itsImplCode, { clarityVersion: 2 }, address2);

  const payload = Cl.tuple({
    target: Cl.address(newImplCA),
    eta: Cl.uint(eta),
    type: Cl.uint(1),
  });
  const payloadHash = Cl.buffer(keccak256(Cl.serialize(payload)));

  const messages = Cl.list([
    Cl.tuple({
      "source-chain": sourceChain,
      "message-id": messageId,
      "source-address": sourceAddress,
      "contract-address": contractAddress,
      "payload-hash": payloadHash,
    }),
  ]);

  const { result: impl } = simnet.callReadOnlyFn(
    `${scope}-service-storage`,
    `get-${suffix}-impl`,
    [],
    address1,
  );
  expect(impl).toBePrincipal(currentImplCA);

  const proofSigners = deployGateway(getSigners(0, 10, 1, 4, "1"));

  const signersHash = (() => {
    const { result } = simnet.callReadOnlyFn(
      "gateway-impl",
      "get-signers-hash",
      [signersToCv(proofSigners)],
      address1,
    );
    return cvToJSON(result).value;
  })();

  const dataHash = (() => {
    const { result } = simnet.callReadOnlyFn(
      "gateway-impl",
      "data-hash-from-messages",
      [messages],
      address1,
    );
    return cvToJSON(result).value;
  })();

  const messageHashToSign = (() => {
    const { result } = simnet.callReadOnlyFn(
      "gateway-impl",
      "message-hash-to-sign",
      [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)],
      address1,
    );
    return cvToJSON(result).value;
  })();

  const proof = makeProofCV(proofSigners, messageHashToSign);

  // approve message on the gateway
  const { result: resultApprove } = simnet.callPublicFn(
    "gateway",
    "approve-messages",
    [
      gatewayImplCV,
      Cl.buffer(Cl.serialize(messages)),
      Cl.buffer(Cl.serialize(proof)),
    ],
    address1,
  );
  expect(resultApprove).toBeOk(Cl.bool(true));

  // execute on the governance
  const { result: resultExecute } = simnet.callPublicFn(
    "governance",
    "execute",
    [
      gatewayImplCV,
      sourceChain,
      messageId,
      sourceAddress,
      Cl.buffer(Cl.serialize(payload)),
    ],
    address1,
  );
  expect(resultExecute).toBeOk(Cl.bool(true));

  // check timelock
  const { result: timelock } = simnet.callReadOnlyFn(
    "governance",
    "get-timelock",
    [payloadHash],
    address1,
  );
  expect(timelock).toStrictEqual(payload);

  while (Number(simnet.getBlockTime()) < eta) {
    simnet.mineBlock([]);
  }

  // finalize
  const { result: resultFinalize } = simnet.callPublicFn(
    "governance",
    "finalize",
    [Cl.contractPrincipal(deployer, prefix), Cl.buffer(Cl.serialize(payload))],
    address1,
  );
  expect(resultFinalize).toBeOk(Cl.bool(true));

  // gateway impl should be updated
  const { result: impl2 } = simnet.callReadOnlyFn(
    `${scope}-service-storage`,
    `get-${suffix}-impl`,
    [],
    address1,
  );
  expect(impl2).toBePrincipal(newImplCA);
}
