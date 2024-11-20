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
    ], address1).result).toBeErr(uintCV(60152)); // ERR-NOT-STARTED

    expect(simnet.callPublicFn("gas-service", "add-native-gas", [
      gasImplContract,
      uintCV(1000),
      bufferCV(Buffer.from("txhash")),
      uintCV(0),
      principalCV(address1)
    ], address1).result).toBeErr(uintCV(60152));

    expect(simnet.callPublicFn("gas-service", "refund", [
      gasImplContract,
      bufferCV(Buffer.from("txhash")),
      uintCV(0),
      principalCV(address1),
      uintCV(1000)
    ], address1).result).toBeErr(uintCV(60152));

    expect(simnet.callPublicFn("gas-service", "collect-fees", [
      gasImplContract,
      principalCV(address1),
      uintCV(1000)
    ], address1).result).toBeErr(uintCV(60152));
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

      expect(result).toBeErr(uintCV(10112)); // ERR-INVALID-AMOUNT
    });

    it("should check balance for refunds", () => {
      const { result } = simnet.callPublicFn("gas-service", "refund", [
        gasImplContract,
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address2),
        uintCV(1000000000)
      ], deployer);

      expect(result).toBeErr(uintCV(10111)); // ERR-INSUFFICIENT-BALANCE
    });

    // Governance and Implementation tests
    it("should only allow governance to set implementation", () => {
      const newImpl = contractPrincipalCV(deployer, "new-impl");
      
      // Test with non-governance caller
      expect(simnet.callPublicFn("gas-service", "set-impl", [
        newImpl
      ], address1).result).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
    });

    // Refund validation tests
    it("should validate refund parameters", () => {
      // Test with invalid tx hash
      expect(simnet.callPublicFn("gas-service", "refund", [
        gasImplContract,
        bufferCV(Buffer.from("")),
        uintCV(0),
        principalCV(address1),
        uintCV(1000)
      ], address1).result).toBeErr(uintCV(10111));
    });

    // Fee collection tests
    it("should validate fee collection", () => {
      // Test collecting more than available balance
      const balanceCV = simnet.callPublicFn(
        "gas-service",
        "get-balance",
        [gasImplContract],
        deployer
      ).result;
      
      const balance = Number(cvToValue(balanceCV).value);
      
      expect(simnet.callPublicFn("gas-service", "collect-fees", [
        gasImplContract,
        principalCV(address1),
        uintCV(balance + 1000)
      ], address1).result).toBeErr(uintCV(10111)); // ERR-INSUFFICIENT-BALANCE
    });

    // Unimplemented function tests
    it("should return not implemented for legacy functions", () => {
      expect(simnet.callPublicFn("gas-service", "pay-gas-for-contract-call", [
        uintCV(1000),
        principalCV(address1),
        stringAsciiCV("chain"),
        stringAsciiCV("address"),
        bufferCV(Buffer.from("payload")),
        principalCV(address1)
      ], address1).result).toBeErr(uintCV(103)); // err-not-implemented
      
      expect(simnet.callPublicFn("gas-service", "add-gas", [
        uintCV(1000),
        principalCV(address1),
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address1)
      ], address1).result).toBeErr(uintCV(103));
      
      expect(simnet.callPublicFn("gas-service", "pay-native-gas-for-express-call", [
        uintCV(1000),
        principalCV(address1),
        stringAsciiCV("chain"),
        stringAsciiCV("address"),
        bufferCV(Buffer.from("payload")),
        principalCV(address1)
      ], address1).result).toBeErr(uintCV(103));
      
      expect(simnet.callPublicFn("gas-service", "add-native-express-gas", [
        uintCV(1000),
        principalCV(address1),
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address1)
      ], address1).result).toBeErr(uintCV(103));
    });

    // Event emission tests
    it("should emit events correctly", () => {
      const { events } = simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
        gasImplContract,
        uintCV(1000),
        principalCV(address1),
        stringAsciiCV("chain"),
        stringAsciiCV("address"),
        bufferCV(Buffer.from("payload")),
        principalCV(address1)
      ], address1);
      
      expect(events).toHaveLength(2);
      expect(events[0].event).toBe("stx_transfer_event");
      expect(events[1].event).toBe("print_event");
      expect(events[1].data.topic).toBe("print");
      // Verify event data
    });

    // Balance tracking tests
    it("should track balances correctly across operations", () => {
      const initialBalance = Number(cvToValue(simnet.callPublicFn(
        "gas-service",
        "get-balance",
        [gasImplContract],
        deployer
      ).result).value);
      
      // Add gas
      simnet.callPublicFn("gas-service", "add-native-gas", [
        gasImplContract,
        uintCV(1000),
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address1)
      ], address1);
      
      // Verify balance increased
      const afterAddBalance = Number(cvToValue(simnet.callPublicFn(
        "gas-service",
        "get-balance",
        [gasImplContract],
        deployer
      ).result).value);
      
      expect(afterAddBalance).toBe(initialBalance + 1000);
      
      // Perform refund
      simnet.callPublicFn("gas-service", "refund", [
        gasImplContract,
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address2),
        uintCV(500)
      ], deployer);
      
      // Verify balance decreased
      const finalBalance = Number(cvToValue(simnet.callPublicFn(
        "gas-service",
        "get-balance",
        [gasImplContract],
        deployer
      ).result).value);
      
      expect(finalBalance).toBe(afterAddBalance - 500);
    });

    // Add these new tests for transfer-ownership
    describe("ownership management", () => {
      it("should allow owner to transfer ownership", () => {
        // First verify current owner
        const ownerCV = simnet.callReadOnlyFn(
          "gas-storage",
          "get-owner",
          [],
          deployer
        ).result;
        expect(cvToValue(ownerCV)).toBe(deployer);

        // Transfer ownership
        const { result } = simnet.callPublicFn(
          "gas-service",
          "transfer-ownership",
          [gasImplContract, principalCV(address1)],
          deployer
        );
        expect(result).toBeOk(boolCV(true));

        // Verify new owner
        const newOwnerCV = simnet.callReadOnlyFn(
          "gas-storage",
          "get-owner",
          [],
          deployer
        ).result;
        expect(cvToValue(newOwnerCV)).toBe(address1);
      });

      it("should prevent non-owner from transferring ownership", () => {
        // Attempt transfer from non-owner account
        const { result } = simnet.callPublicFn(
          "gas-service",
          "transfer-ownership",
          [gasImplContract, principalCV(address2)],
          address1
        );
        expect(result).toBeErr(uintCV(10151)); // ERR-ONLY-OWNER

        // Verify owner hasn't changed
        const ownerCV = simnet.callReadOnlyFn(
          "gas-storage",
          "get-owner",
          [],
          deployer
        ).result;
        expect(cvToValue(ownerCV)).toBe(deployer);
      });
    });
  });
}); 