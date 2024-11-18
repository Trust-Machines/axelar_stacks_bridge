import { describe, expect, it } from "vitest";
import { bufferCV, principalCV, stringAsciiCV, uintCV, contractPrincipalCV, boolCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

describe("gas storage tests", () => {
  it("should only allow authorized contracts", () => {
    const { result } = simnet.callPublicFn("gas-storage", "set-owner", [
      principalCV(address1)
    ], address1);

    expect(result).toBeErr(uintCV(1000));
  });

  it("should manage started status", () => {
    const { result: initialStatus } = simnet.callPublicFn("gas-storage", "get-is-started", [], address1);
    expect(initialStatus).toBeOk(boolCV(false));

    const { result: isStarted } = simnet.callPublicFn("gas-storage", "start", [], address1);
    expect(isStarted).toBeOk(boolCV(true));

    const { result: updatedStatus } = simnet.callPublicFn("gas-storage", "get-is-started", [], address1);
    expect(updatedStatus).toBeOk(boolCV(true));
  });

  it("should manage owner", () => {
    const { result: initialOwner } = simnet.callPublicFn("gas-storage", "get-owner", [], address1);
    expect(initialOwner).toBeOk(principalCV(deployer));

    simnet.callPublicFn("gas-service", "transfer-ownership", [
      contractPrincipalCV(deployer, "gas-impl"),
      principalCV(address1)
    ], deployer);

    const { result: updatedOwner } = simnet.callPublicFn("gas-storage", "get-owner", [], address1);
    expect(updatedOwner).toBeOk(principalCV(address1));
  });

  it("should emit events", () => {
    simnet.callPublicFn("gas-storage", "start", [], deployer);

    const { events } = simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
      contractPrincipalCV(deployer, "gas-impl"),
      uintCV(1000),
      principalCV(address1),
      stringAsciiCV("chain"),
      stringAsciiCV("address"),
      bufferCV(Buffer.from("payload")),
      principalCV(address1)
    ], address1);

    expect(events[0].data.contract_identifier).toBe(`${deployer}.gas-storage`);
    expect(events[0].data.topic).toBe("native-gas-paid-for-contract-call");
  });

  it("should only allow authorized contracts to start", () => {
    const { result } = simnet.callPublicFn(
      "gas-storage",
      "start",
      [],
      address1  // Unauthorized caller
    );
    expect(result).toBeErr(uintCV(1000)); // err-unauthorized
  });
}); 