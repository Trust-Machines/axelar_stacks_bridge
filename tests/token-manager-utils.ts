import { Cl } from "@stacks/transactions";
import { expect, it } from "vitest";
import {
  getFlowLimit,
  getTokenFlowIn,
  getTokenFlowOut,
  giveToken,
  nextEpoch,
  takeToken,
  transferSip010,
} from "./its-utils";
import { NIT_ERRORS, TOKEN_MANAGER_ERRORS } from "./constants";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;

export function runFlowLimitsSuite({
  flowLimit,
  tokenAddress,
  tokenManagerAddress,
}: {
  flowLimit: number;
  tokenAddress: string;
  tokenManagerAddress: string;
}) {
  const FLOW_LIMIT_EXCEEDED = tokenManagerAddress.includes("token-manager")
    ? TOKEN_MANAGER_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"]
    : NIT_ERRORS["ERR-FLOW-LIMIT-EXCEEDED"];
  it("Should be able to set the flow limit", () => {
    const tx = simnet.callPublicFn(
      tokenManagerAddress,
      "set-flow-limit",
      [Cl.uint(flowLimit)],
      address1,
    );

    expect(tx.result).toBeOk(Cl.bool(true));
    const flowLimitValue = getFlowLimit(tokenManagerAddress);
    expect(flowLimitValue.result).toBeOk(Cl.uint(flowLimit));
  });

  it("Should test flow in", () => {
    for (let i = 0; i < flowLimit; i++) {
      const giveTX = giveToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: 1,
        receiver: address2,
        sender: address1,
      });

      expect(giveTX.result).toBeOk(Cl.bool(true));

      expect(getTokenFlowIn(tokenManagerAddress).result).toBeOk(Cl.uint(i + 1));
    }
    expect(
      giveToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: 1,
        receiver: address2,
        sender: address1,
      }).result,
    ).toBeErr(FLOW_LIMIT_EXCEEDED);
    nextEpoch();
    expect(getTokenFlowIn(tokenManagerAddress).result).toBeOk(Cl.uint(0));

    expect(
      giveToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: 1,
        receiver: address2,
        sender: address1,
      }).result,
    ).toBeOk(Cl.bool(true));
  });

  it("Should test flow out", () => {
    expect(
      transferSip010({
        amount: 100,
        sender: simnet.deployer,
        recipient: address1,
        contractAddress: tokenAddress,
      }).result,
    ).toBeOk(Cl.bool(true));
    expect(getTokenFlowOut(tokenManagerAddress).result).toBeOk(Cl.uint(0));
    for (let i = 0; i < flowLimit; i++) {
      const takeTX = takeToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: 1,
        from: address1,
        sender: address1,
      });

      expect(takeTX.result).toBeOk(Cl.bool(true));

      expect(getTokenFlowOut(tokenManagerAddress).result).toBeOk(
        Cl.uint(i + 1),
      );
    }
    expect(
      takeToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: 1,
        from: address1,
        sender: address1,
      }).result,
    ).toBeErr(FLOW_LIMIT_EXCEEDED);
    nextEpoch();
    expect(getTokenFlowOut(tokenManagerAddress).result).toBeOk(Cl.uint(0));

    expect(
      takeToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: 1,
        from: address1,
        sender: address1,
      }).result,
    ).toBeOk(Cl.bool(true));
  });

  it("Should revert if single flow amount exceeds the flow limit", () => {
    const excessiveFlowAmount = flowLimit + 1;
    expect(
      giveToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: flowLimit - 1,
        receiver: address2,
        sender: address1,
      }).result,
    ).toBeOk(Cl.bool(true));
    expect(
      giveToken({
        contractName: tokenManagerAddress,
        tokenAddress: tokenAddress,
        amount: excessiveFlowAmount,
        receiver: address2,
        sender: address1,
      }).result,
    ).toBeErr(FLOW_LIMIT_EXCEEDED);
  });
}
