import { beforeEach, describe, expect } from "vitest";
import {
  getTokenId,
  mintNIT,
  setTokenFlowLimit,
  setupNIT,
  setupService,
} from "./its-utils";
import { runFlowLimitsSuite } from "./token-manager-utils";
import { getNITMockCv, nitMockParams } from "./verification-util";
import { BufferCV, Cl, randomBytes } from "@stacks/transactions";
import { getSigners } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;
const contractName = `${nitMockParams.deployer}.${nitMockParams.name}`;

describe("Native Interchain Token", () => {
  const salt = randomBytes(32);
  const tokenId = getTokenId(salt).result as BufferCV;

  describe("FlowLimit", async () => {
    const flowLimit = 5;

    beforeEach(() => {
      getNITMockCv();
      const proofSigners = getSigners(0, 10, 1, 10, "1");
      setupService(proofSigners, address1);
      expect(
        setupNIT({
          tokenId,
          contract: contractName,
          sender: address1,
          minter: address2,
        }).result
      ).toBeOk(Cl.bool(true));
      setTokenFlowLimit(contractName, flowLimit);
      expect(
        mintNIT({
          NITAddress: contractName,
          minter: address2,
          amount: 10000,
        }).result
      ).toBeOk(Cl.bool(true));
      expect(
        mintNIT({
          NITAddress: contractName,
          minter: address2,
          amount: 10000,
          recipient: deployer,
        }).result
      ).toBeOk(Cl.bool(true));
    });

    runFlowLimitsSuite({
      flowLimit,
      tokenAddress: contractName,
      tokenManagerAddress: contractName,
    });
  });
});
