import { describe, expect, it, beforeEach } from "vitest";
import { boolCV, bufferCV, principalCV, stringAsciiCV, uintCV, contractPrincipalCV } from "@stacks/transactions";
import { deployGasService } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

const gasImplCV = contractPrincipalCV(deployer, "gas-impl");

describe("gas service tests", () => {
  describe("setup", () => {
    it("should initialize correctly", () => {
      const gasImplAddress = `${deployer}.gas-impl`;
      const { result } = simnet.callPublicFn(
        "gas-service",
        "initialize",
        [principalCV(gasImplAddress)],
        deployer
      );
      expect(result).toBeOk(boolCV(true));
      
      // Verify started status
      const { result: startedStatus } = simnet.callPublicFn(
        "gas-storage",
        "get-is-started",
        [],
        deployer
      );
      expect(startedStatus).toBeOk(boolCV(true));
    });

    it("should prevent double initialization", () => {
      // First setup
      deployGasService();
      
      // Try second setup
      const gasImplAddress = `${deployer}.gas-impl`;
      const { result } = simnet.callPublicFn(
        "gas-service",
        "initialize",
        [principalCV(gasImplAddress)],
        deployer
      );
      expect(result).toBeErr(uintCV(101)); // err-already-initialized
    });
  });

  it("should revert all public functions before initialization", () => {
    expect(simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
      gasImplCV,
      uintCV(1000),
      principalCV(address1),
      stringAsciiCV("chain"),
      stringAsciiCV("address"),
      bufferCV(Buffer.from("payload")),
      principalCV(address1)
    ], address1).result).toBeErr(uintCV(106));

    expect(simnet.callPublicFn("gas-service", "add-native-gas", [
      gasImplCV,
      uintCV(1000),
      bufferCV(Buffer.from("txhash")),
      uintCV(0),
      principalCV(address1)
    ], address1).result).toBeErr(uintCV(106));

    expect(simnet.callPublicFn("gas-service", "refund", [
      gasImplCV,
      bufferCV(Buffer.from("txhash")),
      uintCV(0),
      principalCV(address1),
      uintCV(1000)
    ], address1).result).toBeErr(uintCV(106));

    expect(simnet.callPublicFn("gas-service", "collect-fees", [
      gasImplCV,
      principalCV(address1),
      uintCV(1000)
    ], address1).result).toBeErr(uintCV(106));
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
      ], address1).result).toBeErr(uintCV(102));
    });

    it("should pay native gas for contract call", () => {
      const { result } = simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
        gasImplCV,
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
        gasImplCV,
        uintCV(1000),
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address1)
      ], address1);

      expect(result).toBeOk(boolCV(true));
    });

    it("should only allow owner to refund", () => {
      const { result: ownerResult } = simnet.callPublicFn("gas-service", "refund", [
        gasImplCV,
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address2),
        uintCV(1000)
      ], deployer);

      expect(ownerResult).toBeOk(boolCV(true));

      const { result: nonOwnerResult } = simnet.callPublicFn("gas-service", "refund", [
        gasImplCV,
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address2),
        uintCV(1000)
      ], address1);

      expect(nonOwnerResult).toBeErr(uintCV(103));
    });

    it("should only allow owner to collect fees", () => {
      const { result: ownerResult } = simnet.callPublicFn("gas-service", "collect-fees", [
        gasImplCV,
        principalCV(address2),
        uintCV(1000)
      ], deployer);

      expect(ownerResult).toBeOk(boolCV(true));

      const { result: nonOwnerResult } = simnet.callPublicFn("gas-service", "collect-fees", [
        gasImplCV,
        principalCV(address2),
        uintCV(1000)
      ], address1);

      expect(nonOwnerResult).toBeErr(uintCV(103));
    });

    it("should validate receiver address for refunds", () => {
      const { result } = simnet.callPublicFn("gas-service", "refund", [
        gasImplCV,
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV('SP000000000000000000002Q6VF78'),
        uintCV(1000)
      ], deployer);

      expect(result).toBeErr(uintCV(105));
    });

    it("should validate receiver address for fee collection", () => {
      const { result } = simnet.callPublicFn("gas-service", "collect-fees", [
        gasImplCV,
        principalCV('SP000000000000000000002Q6VF78'),
        uintCV(1000)
      ], deployer);

      expect(result).toBeErr(uintCV(105));
    });

    it("should validate amount for gas payments", () => {
      const { result } = simnet.callPublicFn("gas-service", "pay-native-gas-for-contract-call", [
        gasImplCV,
        uintCV(0),
        principalCV(address1),
        stringAsciiCV("chain"),
        stringAsciiCV("address"),
        bufferCV(Buffer.from("payload")),
        principalCV(address1)
      ], address1);

      expect(result).toBeErr(uintCV(102));
    });

    it("should check balance for refunds", () => {
      const { result } = simnet.callPublicFn("gas-service", "refund", [
        gasImplCV,
        bufferCV(Buffer.from("txhash")),
        uintCV(0),
        principalCV(address2),
        uintCV(1000000000)
      ], deployer);

      expect(result).toBeErr(uintCV(101));
    });
  });
}); 