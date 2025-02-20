import {
  boolCV,
  bufferCV,
  cvToValue,
  principalCV,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";
import { deployGasService, gasImplContract } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;

describe("gas-impl tests", () => {
  beforeEach(() => {
    // Deploy gas service with address2 as gas collector
    deployGasService(address2);
  });

  describe("pay-native-gas-for-contract-call", () => {
    it("should fail on direct call to implementation", () => {
      const { result } = simnet.callPublicFn(
        "gas-impl",
        "pay-native-gas-for-contract-call",
        [
          uintCV(1000),
          principalCV(address1),
          stringAsciiCV("chain"),
          stringAsciiCV("address"),
          bufferCV(Buffer.from("payload")),
          principalCV(address1),
        ],
        address1
      );
      expect(result).toBeErr(uintCV(20003)); // ERR-UNAUTHORIZED
    });
  });

  describe("add-native-gas", () => {
    it("should fail on direct call to implementation", () => {
      const { result } = simnet.callPublicFn(
        "gas-impl",
        "add-native-gas",
        [
          uintCV(0),
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
        ],
        address1
      );
      expect(result).toBeErr(uintCV(20003)); // ERR_UNAUTHORIZE
    });
  });

  describe("refund", () => {
    // Use deployer address as the owner
    const deployer = simnet.deployer;

    beforeEach(() => {
      // Add initial balance for refund tests
      simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          gasImplContract,
          uintCV(5000),
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
        ],
        address1
      );
    });

    it("should fail when called by non-gas-collector", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(1000),
        ],
        address1 // Call from non-gas-collector address
      );
      expect(result).toBeErr(uintCV(20006)); // ERR-GAS-COLLECTOR-ONLY
    });

    it("should fail when amount is zero", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(0),
        ],
        address2 // Call from gas collector
      );
      expect(result).toBeErr(uintCV(20001)); // ERR-INVALID-AMOUNT
    });

    it("should fail when amount exceeds balance", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(10000), // More than available
        ],
        address2 // Call from gas collector
      );
      expect(result).toBeErr(uintCV(20000)); // ERR-INSUFFICIENT-BALANCE
    });

    it("should successfully refund when called by gas collector", () => {
      const initialBalance = Number(
        cvToValue(
          simnet.callReadOnlyFn("gas-impl", "get-balance", [], deployer).result
        ).value
      );

      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(2000),
        ],
        address2 // Call from gas collector
      );

      expect(result).toBeOk(boolCV(true));

      // Verify balance was reduced
      const finalBalance = Number(
        cvToValue(
          simnet.callReadOnlyFn("gas-impl", "get-balance", [], deployer).result
        ).value
      );
      expect(finalBalance).toBe(initialBalance - 2000);
    });
  });

  describe("collect-fees", () => {
    beforeEach(() => {
      // Add initial balance for fee collection tests
      simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          gasImplContract,
          uintCV(5000),
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
        ],
        address1
      );
    });

    it("should fail when called by non-gas-collector", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [gasImplContract, principalCV(address3), uintCV(1000)],
        address1 // Call from non-gas-collector address
      );
      expect(result).toBeErr(uintCV(20006)); // ERR-GAS-COLLECTOR-ONLY
    });

    it("should fail when amount is zero", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [gasImplContract, principalCV(address3), uintCV(0)],
        address2 // Call from gas collector
      );
      expect(result).toBeErr(uintCV(20001)); // ERR-INVALID-AMOUNT
    });

    it("should fail when amount exceeds balance", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [gasImplContract, principalCV(address3), uintCV(10000)], // More than available
        address2 // Call from gas collector
      );
      expect(result).toBeErr(uintCV(20000)); // ERR-INSUFFICIENT-BALANCE
    });

    it("should successfully collect fees when called by gas collector", () => {
      const initialBalance = Number(
        cvToValue(
          simnet.callReadOnlyFn("gas-impl", "get-balance", [], address1).result
        ).value
      );

      const { result } = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [gasImplContract, principalCV(address3), uintCV(2000)],
        address2 // Call from gas collector
      );

      expect(result).toBeOk(boolCV(true));

      // Verify balance was reduced
      const finalBalance = Number(
        cvToValue(
          simnet.callReadOnlyFn("gas-impl", "get-balance", [], address1).result
        ).value
      );
      expect(finalBalance).toBe(initialBalance - 2000);
    });
  });

  describe("get-balance", () => {
    it("should return correct balance", () => {
      // Initial balance should be 0
      let { result } = simnet.callReadOnlyFn(
        "gas-impl",
        "get-balance",
        [],
        address1
      );
      expect(result).toBeOk(uintCV(0));

      // Add some balance
      simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          gasImplContract,
          uintCV(2000),
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
        ],
        address1
      );

      // Check updated balance
      result = simnet.callReadOnlyFn(
        "gas-impl",
        "get-balance",
        [],
        address1
      ).result;
      expect(result).toBeOk(uintCV(2000));
    });
  });
});

describe("transfer-ownership", () => {
  beforeEach(() => {
    // Deploy gas service with address2 as gas collector
    deployGasService(address2);
  });
  it("should handle valid ownership transfer", () => {
    const { result } = simnet.callPublicFn(
      "gas-service",
      "transfer-ownership",
      [gasImplContract, principalCV(address1)],
      simnet.deployer
    );
    expect(result).toBeOk(boolCV(true));
  });

  it("should fail when called by non-owner", () => {
    const { result } = simnet.callPublicFn(
      "gas-service",
      "transfer-ownership",
      [gasImplContract, principalCV(address2)],
      address1
    );
    expect(result).toBeErr(uintCV(20005)); // ERR-ONLY-OWNER
  });
});
