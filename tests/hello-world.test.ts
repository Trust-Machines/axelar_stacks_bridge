import { describe, expect, it } from "vitest";
import { deployGateway, gatewayImplCV, getSigners, makeProofCV, signersToCv } from "./util";
import { boolCV, bufferCV, cvToJSON, Cl, listCV, serializeCV, stringAsciiCV, tupleCV, contractPrincipalCV, uintCV } from "@stacks/transactions";
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


  it("Should set remote value", () => {
    deployGateway(getSigners(0, 10, 1, 4, "1"));
    const destinationChain = stringAsciiCV("avalanche-fuji");
    const destinationContractAddress = stringAsciiCV("0xC993dBcdC94E2115C7C1526D2Dec78B384Bb826D");
    const payload = Cl.bufferFromHex("0x00");
    const gasAmount = uintCV(1000000);
    const gasImplCV = contractPrincipalCV(accounts.get("deployer")!, "gas-impl");

    const { result } = simnet.callPublicFn("hello-world", "set-remote-value", [destinationChain, destinationContractAddress, payload, gasAmount, gatewayImplCV, gasImplCV], address1);
    expect(result).toBeOk(boolCV(true));
  });
});
