import { beforeEach, describe, expect, it } from "vitest";
import { getTokenId, mintNIT, setupNIT, setTokenFlowLimit } from "./its-utils";
import { BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { NIT_ERRORS } from "./constants";
import { runFlowLimitsSuite } from "./token-manager-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
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
    runFlowLimitsSuite({
      flowLimit,
      tokenAddress: `${deployer}.native-interchain-token`,
      tokenManagerAddress: `${deployer}.native-interchain-token`,
    });
  });
  describe("Interchain Token", () => {
    it("revert on init if tokenId is 0", () => {
      expect(
        setupNIT({
          tokenId: Cl.bufferFromHex("0x"),
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
    it("revert on init if token name is invalid", () => {
      expect(
        setupNIT({
          tokenId,
          name: "",
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
    it("revert on init if token symbol is invalid", () => {
      expect(
        setupNIT({
          tokenId,
          symbol: "",
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
  });
});
