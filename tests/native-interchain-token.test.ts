import { beforeEach, describe, expect, it } from "vitest";
import {
  getTokenId,
  mintNIT,
  setupNIT,
  setupService,
  giveToken,
  takeToken,
} from "./its-utils";
import { BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { getSigners } from "./util";
import { NIT_ERRORS } from "./constants";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/
const proofSigners = getSigners(0, 10, 1, 10, "1");
function getFlowIn() {
  return simnet.callReadOnlyFn(
    "native-interchain-token",
    "get-flow-in-amount",
    [],
    address1
  );
}
function getFlowOut() {
  return simnet.callReadOnlyFn(
    "native-interchain-token",
    "get-flow-out-amount",
    [],
    address1
  );
}

function setFlowLimit(limit: number) {
  return simnet.callPublicFn(
    "native-interchain-token",
    "set-flow-limit",
    [Cl.uint(limit)],
    address1
  );
}
function nextEpoch() {
  simnet.mineEmptyBlocks(36);
}
describe("Native Interchain Token", () => {
  describe("FlowLimit", async () => {
    const salt = randomBytes(32);
    const tokenId = getTokenId(salt).result as BufferCV;
    const flowLimit = 5;

    beforeEach(() => {
      setupService(proofSigners);
      setupNIT({
        tokenId,
        operator: address1,
        minter: address1,
      });
      setFlowLimit(flowLimit);
      mintNIT({
        minter: address1,
        amount: 100,
      });
    });

    it("Should be able to set the flow limit", async () => {
      const tx = simnet.callPublicFn(
        "native-interchain-token",
        "set-flow-limit",
        [Cl.uint(flowLimit)],
        address1
      );
      expect(tx.result).toBeOk(Cl.bool(true));
      const flowLimitValue = simnet.callReadOnlyFn(
        "native-interchain-token",
        "get-flow-limit",
        [],
        address1
      );
      expect(flowLimitValue.result).toBeOk(Cl.uint(flowLimit));
    });

    it("Should test flow in", async () => {
      for (let i = 0; i < flowLimit; i++) {
        const giveTX = giveToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address2,
          sender: address1,
        });

        expect(giveTX.result).toBeOk(Cl.bool(true));

        expect(getFlowIn().result).toBeOk(Cl.uint(i + 1));
      }
      expect(
        giveToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address2,
          sender: address1,
        }).result
      ).toBeErr(NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]);
      nextEpoch();
      expect(getFlowIn().result).toBeOk(Cl.uint(0));

      expect(
        giveToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address2,
          sender: address1,
        }).result
      ).toBeOk(Cl.bool(true));
    });

    it("Should test flow out", async () => {
      for (let i = 0; i < flowLimit; i++) {
        const takeTX = takeToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address1,
          sender: address1,
        });

        expect(takeTX.result).toBeOk(Cl.bool(true));

        expect(getFlowOut().result).toBeOk(Cl.uint(i + 1));
      }
      expect(
        takeToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address1,
          sender: address1,
        }).result
      ).toBeErr(NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]);
      nextEpoch();
      expect(getFlowOut().result).toBeOk(Cl.uint(0));

      expect(
        takeToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address1,
          sender: address1,
        }).result
      ).toBeOk(Cl.bool(true));
    });

    it("Should revert if single flow amount exceeds the flow limit", async () => {
      const excessiveFlowAmount = flowLimit + 1;
      expect(
        giveToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: flowLimit - 1,
          receiver: address2,
          sender: address1,
        }).result
      ).toBeOk(Cl.bool(true));
      expect(
        giveToken({
          contractName: "native-interchain-token",
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: excessiveFlowAmount,
          receiver: address2,
          sender: address1,
        }).result
      ).toBeErr(NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]);
    });
  });
});
