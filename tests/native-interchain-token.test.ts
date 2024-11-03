import { beforeEach, describe, expect, it } from "vitest";
import {
  getTokenId,
  mintNIT,
  setupNIT,
  giveToken,
  takeToken,
  getTokenFlowIn,
  getTokenFlowOut,
  setTokenFlowLimit,
  nextEpoch,
  getFlowLimit,
} from "./its-utils";
import { BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { NIT_ERRORS } from "./constants";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;
const contractName = "native-interchain-token";

describe("Native Interchain Token", () => {
  const salt = randomBytes(32);
  const tokenId = getTokenId(salt).result as BufferCV;
  describe("FlowLimit", async () => {
    const flowLimit = 5;

    beforeEach(() => {
      setupNIT({
        tokenId,
        operator: address1,
        minter: address1,
      });
      setTokenFlowLimit(contractName, flowLimit);
      mintNIT({
        minter: address1,
        amount: 100,
      });
    });

    it("Should be able to set the flow limit", async () => {
      const tx = simnet.callPublicFn(
        contractName,
        "set-flow-limit",
        [Cl.uint(flowLimit)],
        address1
      );
      expect(tx.result).toBeOk(Cl.bool(true));
      const flowLimitValue = getFlowLimit(contractName);
      expect(flowLimitValue.result).toBeOk(Cl.uint(flowLimit));
    });

    it("Should test flow in", async () => {
      for (let i = 0; i < flowLimit; i++) {
        const giveTX = giveToken({
          contractName: contractName,
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address2,
          sender: address1,
        });

        expect(giveTX.result).toBeOk(Cl.bool(true));

        expect(getTokenFlowIn(contractName).result).toBeOk(Cl.uint(i + 1));
      }
      expect(
        giveToken({
          contractName: contractName,
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address2,
          sender: address1,
        }).result
      ).toBeErr(NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]);
      nextEpoch();
      expect(getTokenFlowIn(contractName).result).toBeOk(Cl.uint(0));

      expect(
        giveToken({
          contractName: contractName,
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
          contractName: contractName,
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address1,
          sender: address1,
        });

        expect(takeTX.result).toBeOk(Cl.bool(true));

        expect(getTokenFlowOut(contractName).result).toBeOk(Cl.uint(i + 1));
      }
      expect(
        takeToken({
          contractName: contractName,
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: 1,
          receiver: address1,
          sender: address1,
        }).result
      ).toBeErr(NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]);
      nextEpoch();
      expect(getTokenFlowOut(contractName).result).toBeOk(Cl.uint(0));

      expect(
        takeToken({
          contractName: contractName,
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
          contractName: contractName,
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: flowLimit - 1,
          receiver: address2,
          sender: address1,
        }).result
      ).toBeOk(Cl.bool(true));
      expect(
        giveToken({
          contractName: contractName,
          tokenAddress: `${deployer}.native-interchain-token`,
          amount: excessiveFlowAmount,
          receiver: address2,
          sender: address1,
        }).result
      ).toBeErr(NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]);
    });
  });

  describe("Interchain Token", () => {
    it("revert on init if service is address(0)", () => {
      expect(
        setupNIT({
          itsAddress: "ST000000000000000000002AMW42H",
          tokenId,
        }).result
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
    it("revert on init if tokenId is 0", () => {
      expect(
        setupNIT({
          tokenId: Cl.bufferFromHex("0x"),
        }).result
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
    it("revert on init if token name is invalid", () => {
      expect(
        setupNIT({
          tokenId,
          name: "",
        }).result
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
    it("revert on init if token symbol is invalid", () => {
      expect(
        setupNIT({
          tokenId,
          symbol: "",
        }).result
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
  });
});
