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
    it("should handle valid payment", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "pay-native-gas-for-contract-call",
        [
          gasImplContract,
          uintCV(1000),
          principalCV(address1),
          stringAsciiCV("chain"),
          stringAsciiCV("address"),
          bufferCV(Buffer.from("payload")),
          principalCV(address1)
        ],
        address1
      );
      expect(result).toBeOk(boolCV(true));
    });

    it("should fail with invalid amount", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "pay-native-gas-for-contract-call",
        [
          gasImplContract,
          uintCV(0),
          principalCV(address1),
          stringAsciiCV("chain"),
          stringAsciiCV("address"),
          bufferCV(Buffer.from("payload")),
          principalCV(address1)
        ],
        address1
      );
      expect(result).toBeErr(uintCV(10112)); // ERR-INVALID-AMOUNT
    });

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
          principalCV(address1)
        ],
        address1
      );
      expect(result).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
    });
  });

  describe("add-native-gas", () => {
    it("should handle valid gas addition", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          gasImplContract,
          uintCV(2000),
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1)
        ],
        address1
      );
      expect(result).toBeOk(boolCV(true));

      // Verify balance increased
      const { result: balanceResult } = simnet.callReadOnlyFn(
        "gas-impl",
        "get-balance",
        [],
        address1
      );
      expect(balanceResult).toBeOk(uintCV(2000));
    });

    it("should fail with invalid amount", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          gasImplContract,
          uintCV(0),
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1)
        ],
        address1
      );
      expect(result).toBeErr(uintCV(10112)); // ERR-INVALID-AMOUNT
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
          principalCV(address1)
        ],
        address1
      );
    });

    it("should handle valid refund when called by owner", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(1000)
        ],
        deployer // Use deployer address
      );
      expect(result).toBeOk(boolCV(true));
    });

    it("should fail when called by non-owner", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(1000)
        ],
        address2 // Call from non-owner address
      );
      expect(result).toBeErr(uintCV(10116)); // ERR-OWNER-ONLY
    });

    it("should fail with insufficient balance", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(10000) // More than available
        ],
        deployer
      );
      expect(result).toBeErr(uintCV(10114)); // ERR-INSUFFICIENT-BALANCE
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
        principalCV(address1)
      ],
      address1
    );
  });

  it("should handle valid fee collection when called by owner", () => {
    const { result } = simnet.callPublicFn(
      "gas-service",
      "collect-fees",
      [
        gasImplContract,
        principalCV(address2),
        uintCV(1000)
      ],
      deployer // Call from owner address
    );
    expect(result).toBeOk(boolCV(true));
  });

  it("should fail when called by non-owner", () => {
    const { result } = simnet.callPublicFn(
      "gas-service",
      "collect-fees",
      [
        gasImplContract,
        principalCV(address2),
        uintCV(1000)
      ],
      address1 // Call from non-owner address
    );
    expect(result).toBeErr(uintCV(10116)); // ERR-OWNER-ONLY
  });

  it("should fail with insufficient balance", () => {
    const { result } = simnet.callPublicFn(
      "gas-service",
      "collect-fees",
      [
        gasImplContract,
        principalCV(address2),
        uintCV(10000) // More than available
      ],
      deployer // Call from owner address
    );
    expect(result).toBeErr(uintCV(10114)); // ERR-INSUFFICIENT-BALANCE
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
          principalCV(address1)
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
      [
        gasImplContract,
        principalCV(address2)
      ],
      simnet.deployer
    );
    expect(result).toBeOk(boolCV(true));
  });

  it("should fail when called by non-owner", () => {
    const { result } = simnet.callPublicFn(
      "gas-service",
      "transfer-ownership",
      [
        gasImplContract,
        principalCV(address2)
      ],
      address1
    );
    expect(result).toBeErr(uintCV(10151)); // ERR-ONLY-OWNER
  });
});