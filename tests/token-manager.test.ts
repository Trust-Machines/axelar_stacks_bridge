import { describe, expect, it } from "vitest";
import { keccak256, setTokenFlowLimit, setupTokenManager } from "./its-utils";
import { TOKEN_MANAGER_ERRORS } from "./constants";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

describe("example tests", () => {
  it("Should revert on token manager deployment with invalid service address", async () => {
    expect(
      setupTokenManager({
        itsAddress: "ST000000000000000000002AMW42H",
        operator: null,
      }).result
    ).toBeErr(TOKEN_MANAGER_ERRORS["ERR-INVALID-PARAMS"]);
  });

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
    const flowLimit = 100;
    expect(
      setTokenFlowLimit("token-manager", flowLimit, address1).result
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

  // it("shows an example", () => {
  //   const { result } = simnet.callReadOnlyFn("counter", "get-counter", [], address1);
  //   expect(result).toBeUint(0);
  // });
});
