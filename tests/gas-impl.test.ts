import {
  boolCV,
  bufferCV,
  principalCV,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";
import { deployGasService, gasImplContract } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;

describe("gas-impl tests", () => {
  beforeEach(() => {
    deployGasService();
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
      expect(result).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
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
      expect(result).toBeErr(uintCV(10111)); // ERR_UNAUTHORIZE
    });
  });

  describe("refund", () => {
    // Use deployer address as the owner
    const deployer = simnet.deployer;

    it("should fail when called by non-owner", () => {
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
        address2 // Call from non-owner address
      );
      expect(result).toBeErr(uintCV(10116)); // ERR-OWNER-ONLY
    });

    it("should fail on direct call to implementation", () => {
      const { result } = simnet.callPublicFn(
        "gas-impl",
        "refund",
        [
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(10000), // More than available
        ],
        deployer
      );
      expect(result).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZE
    });
  });

  describe("collect-fees", () => {
    const deployer = simnet.deployer;

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

    it("should fail when called by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [gasImplContract, principalCV(address2), uintCV(1000)],
        address1 // Call from non-owner address
      );
      expect(result).toBeErr(uintCV(10116)); // ERR-OWNER-ONLY
    });

    it("should fail on direct call to implementation", () => {
      const { result } = simnet.callPublicFn(
        "gas-impl",
        "collect-fees",
        [
          principalCV(address2),
          uintCV(10000), // More than available
        ],
        deployer // Call from owner address
      );
      expect(result).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZE
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
    deployGasService();
  });

  it("should handle valid ownership transfer", () => {
    const { result } = simnet.callPublicFn(
      "gas-service",
      "transfer-ownership",
      [gasImplContract, principalCV(address2)],
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
    expect(result).toBeErr(uintCV(10151)); // ERR-ONLY-OWNER
  });
});
