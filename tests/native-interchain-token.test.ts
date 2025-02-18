import { beforeEach, describe, expect, it } from "vitest";
import { getTokenId, mintNIT, setupNIT, setTokenFlowLimit, itsImpl } from "./its-utils";
import { addressToString, BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { NIT_ERRORS } from "./constants";
import { runFlowLimitsSuite } from "./token-manager-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;
const contractName = deployer + ".native-interchain-token";

describe("Native Interchain Token", () => {
  const salt = randomBytes(32);
  const tokenId = getTokenId(salt).result as BufferCV;

  describe("FlowLimit", async () => {
    const flowLimit = 5;

    beforeEach(() => {
      setupNIT({
        contract: contractName,
        tokenId,
        operator: address1,
        minter: address1,
        sender: deployer,
      });
      setTokenFlowLimit(contractName, flowLimit);
      mintNIT({
        minter: address1,
        amount: 10000,
      });
      mintNIT({
        minter: address1,
        amount: 10000,
        recipient: deployer,
      });
    });

    runFlowLimitsSuite({
      flowLimit,
      tokenAddress: contractName,
      tokenManagerAddress: contractName,
    });
  });
  describe("Interchain Token", () => {
    it("revert on init if tokenId is 0", () => {
      expect(
        setupNIT({
          contract: contractName,
          sender: deployer,
          tokenId: Cl.bufferFromHex("0x"),
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });

    it("revert on init if minter is its impl", () => {
      expect(
        setupNIT({
          contract: contractName,
          sender: deployer,
          tokenId: Cl.bufferFromHex("0x"),
          minter: addressToString(itsImpl.address),
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
    it("revert on init if token name is invalid", () => {
      expect(
        setupNIT({
          contract: contractName,
          sender: deployer,
          tokenId,
          name: "",
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
    it("revert on init if token symbol is invalid", () => {
      expect(
        setupNIT({
          contract: contractName,
          tokenId,
          symbol: "",
          sender: deployer,
        }).result,
      ).toBeErr(NIT_ERRORS["ERR-INVALID-PARAMS"]);
    });
  });
});
