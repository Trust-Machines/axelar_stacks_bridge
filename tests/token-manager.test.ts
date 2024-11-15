import { beforeEach, describe, expect, it } from "vitest";
import {
  keccak256,
  setTokenFlowLimit,
  setupService,
  setupTokenManager,
  transferSip010,
} from "./its-utils";
import { TOKEN_MANAGER_ERRORS } from "./constants";
import { Cl } from "@stacks/transactions";
import { runFlowLimitsSuite } from "./token-manager-utils";
import { getSigners } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

describe("Token Manager", () => {
  it("Should return the correct contract id", async () => {
    const expectedContractid = keccak256(
      Cl.serialize(Cl.stringAscii("token-manager"))
    );
    const contractId = simnet.callReadOnlyFn(
      "token-manager",
      "contract-id",
      [],
      address1
    ).result;
    expect(contractId).toBeOk(Cl.buffer(expectedContractid));
  });

  it("Should revert on setup if not called by the deployer", async () => {
    expect(
      setupTokenManager({
        sender: address1,
      }).result
    ).toBeErr(TOKEN_MANAGER_ERRORS["ERR-NOT-AUTHORIZED"]);
  });

  it("Should revert on setFlowLimit if not called by the operator", async () => {
    expect(
      setupTokenManager({
        operator: address1,
      }).result
    ).toBeOk(Cl.bool(true));
    const flowLimit = 100;
    expect(
      setTokenFlowLimit("token-manager", flowLimit, address2).result
    ).toBeErr(TOKEN_MANAGER_ERRORS["ERR-NOT-AUTHORIZED"]);
  });

  it("Should return the correct parameters for a token manager", async () => {
    const expectedParams = Cl.serialize(
      Cl.tuple({
        operator: Cl.some(Cl.address(address1)),
        "token-address": Cl.address(`${deployer}.sample-sip-010`),
      })
    );

    const params = simnet.callReadOnlyFn(
      "token-manager",
      "get-params",
      [Cl.some(Cl.address(address1)), Cl.address(`${deployer}.sample-sip-010`)],
      address1
    );
    expect(params.result).toBeOk(Cl.buffer(expectedParams));
  });

  describe("Flow Limit", () => {
    const flowLimit = 5;

    beforeEach(() => {
      const proofSigners = getSigners(0, 10, 1, 10, "1");
      setupService(proofSigners, address1);
      expect(
        setupTokenManager({
          operator: address1,
        }).result
      ).toBeOk(Cl.bool(true));

      expect(setTokenFlowLimit("token-manager", flowLimit).result).toBeOk(
        Cl.bool(true)
      );

      expect(
        transferSip010({
          amount: 100,
          sender: deployer,
          recipient: address1,
          contractAddress: `${deployer}.sample-sip-010`,
        }).result
      ).toBeOk(Cl.bool(true));
      expect(
        transferSip010({
          amount: 100,
          sender: deployer,
          recipient: `${deployer}.token-manager`,
          contractAddress: `${deployer}.sample-sip-010`,
        }).result
      ).toBeOk(Cl.bool(true));
    });
    runFlowLimitsSuite({
      flowLimit: 5,
      tokenAddress: `${deployer}.sample-sip-010`,
      tokenManagerAddress: `${deployer}.token-manager`,
    });
  });
});
