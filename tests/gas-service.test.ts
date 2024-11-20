import { describe, expect, it, beforeEach } from "vitest";
import { boolCV, bufferCV, principalCV, stringAsciiCV, uintCV, contractPrincipalCV, cvToValue } from "@stacks/transactions";
import { deployGasService, gasImplContract } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

describe("gas service tests", () => {
  describe("setup", () => {
    it("should initialize correctly", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "setup",
        [],
        deployer
      );
      expect(result).toBeOk(boolCV(true));
      
      // Verify started status
      const { result: startedStatus } = simnet.callReadOnlyFn(
        "gas-storage",
        "get-is-started",
        [],
        deployer
      );
      expect(cvToValue(startedStatus)).toBe(true);

    });

    it("should prevent double initialization", () => {
      // First setup
      deployGasService();
      
      // Try second setup
      const { result } = simnet.callPublicFn(
        "gas-service",
        "setup",
        [],
        deployer
      );
      expect(result).toBeErr(uintCV(6051)); // ERR-STARTED
    });
  });

  it("should revert all public functions before initialization", () => {
    expect(simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
      gasImplContract,
      uintCV(1000),
      principalCV(address1),
      stringAsciiCV("chain"),
      stringAsciiCV("address"),
      bufferCV(Buffer.from("payload")),
      principalCV(address1)
    ], address1).result).toBeErr(uintCV(6052)); // ERR-NOT-STARTED

    expect(simnet.callPublicFn("gas-service", "add-native-gas", [
      gasImplContract,
      uintCV(1000),
      bufferCV(Buffer.from("txhash")),
      uintCV(0),
      principalCV(address1)
    ], address1).result).toBeErr(uintCV(6052));

    expect(simnet.callPublicFn("gas-service", "refund", [
      gasImplContract,
      bufferCV(Buffer.from("txhash")),
      uintCV(0),
      principalCV(address1),
      uintCV(1000)
    ], address1).result).toBeErr(uintCV(6052));

    expect(simnet.callPublicFn("gas-service", "collect-fees", [
      gasImplContract,
      principalCV(address1),
      uintCV(1000)
    ], address1).result).toBeErr(uintCV(6052));
  });

  describe("after initialization", () => {
    beforeEach(() => {
      deployGasService();
    });

    it("should validate implementation contract", () => {
      const invalidImpl = contractPrincipalCV(deployer, "traits");
      
      expect(simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
        invalidImpl,
        uintCV(1000),
        principalCV(address1),
        stringAsciiCV("chain"),
        stringAsciiCV("address"),
        bufferCV(Buffer.from("payload")),
        principalCV(address1)
      ], address1).result).toBeErr(uintCV(10211));
    });

    it("should pay native gas for contract call", () => {
      const { result } = simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
        gasImplContract,
        uintCV(1000),
        principalCV(address1),
        stringAsciiCV("chain"),
        stringAsciiCV("address"),
        bufferCV(Buffer.from("payload")),
        principalCV(address1)
      ], address1);

      expect(result).toBeOk(boolCV(true));
    });

    it("should add native gas", () => {
      const { result } = simnet.callPublicFn("gas-service", "add-native-gas", [
        gasImplContract,
        uintCV(1000),
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address1)
      ], address1);

      expect(result).toBeOk(boolCV(true));
    });

    it("should validate amount for gas payments", () => {
      const { result } = simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
        gasImplContract,
        uintCV(0),
        principalCV(address1),
        stringAsciiCV("chain"),
        stringAsciiCV("address"),
        bufferCV(Buffer.from("payload")),
        principalCV(address1)
      ], address1);

      expect(result).toBeErr(uintCV(102)); // ERR-INVALID-AMOUNT
    });

    it("should check balance for refunds", () => {
      const { result } = simnet.callPublicFn("gas-service", "refund", [
        gasImplContract,
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address2),
        uintCV(1000000000)
      ], deployer);

      expect(result).toBeErr(uintCV(101)); // ERR-INSUFFICIENT-BALANCE
    });
  });
}); 