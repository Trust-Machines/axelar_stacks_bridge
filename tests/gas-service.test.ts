import { describe, expect, it, beforeEach } from "vitest";
import {
  boolCV,
  bufferCV,
  principalCV,
  stringAsciiCV,
  uintCV,
  contractPrincipalCV,
  cvToValue,
} from "@stacks/transactions";
import { deployGasService, gasImplContract } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;
const deployer = accounts.get("deployer")!;

describe("gas service tests", () => {
  beforeEach(() => {
    // Deploy gas service with address1 as gas collector
    deployGasService(address1);
  });

  describe("after initialization", () => {
    it("should validate implementation contract", () => {
      const invalidImpl = contractPrincipalCV(deployer, "traits");

      expect(
        simnet.callPublicFn(
          "gas-service",
          "pay-native-gas-for-contract-call",
          [
            invalidImpl,
            uintCV(1000),
            principalCV(address1),
            stringAsciiCV("chain"),
            stringAsciiCV("address"),
            bufferCV(Buffer.from("payload")),
            principalCV(address1),
          ],
          address1
        ).result
      ).toBeErr(uintCV(10211));
    });

    it("should pay native gas for contract call", () => {
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
          principalCV(address1),
        ],
        address1
      );

      expect(result).toBeOk(boolCV(true));
    });

    it("should add native gas", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          gasImplContract,
          uintCV(1000),
          bufferCV(Buffer.from("txhash")),
          uintCV(0),
          principalCV(address1),
        ],
        address1
      );

      expect(result).toBeOk(boolCV(true));
    });

    it("should validate amount for gas payments", () => {
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
          principalCV(address1),
        ],
        address1
      );

      expect(result).toBeErr(uintCV(10112)); // ERR-INVALID-AMOUNT
    });

    it("should check balance for refunds", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("txhash")),
          uintCV(0),
          principalCV(address2),
          uintCV(1000000000),
        ],
        address1
      );

      expect(result).toBeErr(uintCV(10114)); // ERR-INSUFFICIENT-BALANCE
    });

    // Governance and Implementation tests
    it("should only allow governance to set implementation", () => {
      const newImpl = contractPrincipalCV(deployer, "new-impl");

      // Test with non-governance caller
      expect(
        simnet.callPublicFn("gas-service", "set-impl", [newImpl], address1)
          .result
      ).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
    });

    // Refund validation tests
    it("should validate refund parameters", () => {
      // Test with invalid tx hash
      expect(
        simnet.callPublicFn(
          "gas-service",
          "refund",
          [
            gasImplContract,
            bufferCV(Buffer.from("")),
            uintCV(0),
            principalCV(address1),
            uintCV(1000),
          ],
          address1
        ).result
      ).toBeErr(uintCV(10114)); // ERR-INSUFFICIENT-BALANCE
    });

    // Fee collection tests
    it("should validate fee collection", () => {
      // Test collecting more than available balance
      const balanceCV = simnet.callPublicFn(
        "gas-service",
        "get-balance",
        [gasImplContract],
        address1
      ).result;

      const balance = Number(cvToValue(balanceCV).value);

      expect(
        simnet.callPublicFn(
          "gas-service",
          "collect-fees",
          [gasImplContract, principalCV(address1), uintCV(balance + 1000)],
          address1
        ).result
      ).toBeErr(uintCV(10114)); // ERR-INSUFFICIENT-BALANCE
    });

    // Unimplemented function tests
    it("should return not implemented for legacy functions", () => {
      expect(
        simnet.callPublicFn(
          "gas-service",
          "pay-gas-for-contract-call",
          [
            gasImplContract,
            uintCV(1000),
            principalCV(address1),
            stringAsciiCV("chain"),
            stringAsciiCV("address"),
            bufferCV(Buffer.from("payload")),
            principalCV(address1),
          ],
          address1
        ).result
      ).toBeErr(uintCV(10113)); // err-not-implemented

      expect(
        simnet.callPublicFn(
          "gas-service",
          "add-gas",
          [
            gasImplContract,
            uintCV(1000),
            principalCV(address1),
            bufferCV(Buffer.from("txhash")),
            uintCV(0),
            principalCV(address1),
          ],
          address1
        ).result
      ).toBeErr(uintCV(10113));

      expect(
        simnet.callPublicFn(
          "gas-service",
          "pay-native-gas-for-express-call",
          [
            gasImplContract,
            uintCV(1000),
            principalCV(address1),
            stringAsciiCV("chain"),
            stringAsciiCV("address"),
            bufferCV(Buffer.from("payload")),
            principalCV(address1),
          ],
          address1
        ).result
      ).toBeErr(uintCV(10113));

      expect(
        simnet.callPublicFn(
          "gas-service",
          "add-native-express-gas",
          [
            gasImplContract,
            uintCV(1000),
            principalCV(address1),
            bufferCV(Buffer.from("txhash")),
            uintCV(0),
            principalCV(address1),
          ],
          address1
        ).result
      ).toBeErr(uintCV(10113));
    });

    // Event emission tests
    it("should emit events correctly", () => {
      const { events } = simnet.callPublicFn(
        "gas-service",
        "pay-native-gas-for-contract-call",
        [
          gasImplContract,
          uintCV(1000),
          principalCV(address1),
          stringAsciiCV("chain"),
          stringAsciiCV("address"),
          bufferCV(Buffer.from("payload")),
          principalCV(address1),
        ],
        address1
      );

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe("stx_transfer_event");
      expect(events[1].event).toBe("print_event");
      expect(events[1].data.topic).toBe("print");
      // Verify event data
    });

    // Balance tracking tests
    it("should track balances correctly across operations", () => {
      const initialBalance = Number(
        cvToValue(
          simnet.callPublicFn(
            "gas-service",
            "get-balance",
            [gasImplContract],
            deployer
          ).result
        ).value
      );

      // Add gas
      simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          gasImplContract,
          uintCV(1000),
          bufferCV(Buffer.from("txhash".padEnd(32, "\0"))), // Ensure 32 bytes
          uintCV(0),
          principalCV(address1),
        ],
        address1
      );

      // Verify balance increased
      const afterAddBalance = Number(
        cvToValue(
          simnet.callPublicFn(
            "gas-service",
            "get-balance",
            [gasImplContract],
            deployer
          ).result
        ).value
      );

      expect(afterAddBalance).toBe(initialBalance + 1000);

      // Perform refund
      simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("txhash")),
          uintCV(0),
          principalCV(address2),
          uintCV(500),
        ],
        address1
      );

      // Verify balance decreased
      const finalBalance = Number(
        cvToValue(
          simnet.callPublicFn(
            "gas-service",
            "get-balance",
            [gasImplContract],
            deployer
          ).result
        ).value
      );

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
          [gasImplContract, principalCV(address2)],
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
        expect(cvToValue(newOwnerCV)).toBe(address2);
      });

      it("should prevent gas collector from becoming the owner", () => {
         // Transfer ownership
        const { result } = simnet.callPublicFn(
          "gas-service",
          "transfer-ownership",
          [gasImplContract, principalCV(address1)],
          deployer
        );
        expect(result).toBeErr(uintCV(10112));
      })

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

  describe("gas collector management", () => {
    it("should fail when non-gas-collector tries to transfer gas collector role", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "transfer-gas-collector",
        [gasImplContract, principalCV(address3)],
        address2 // Call from non-gas-collector address
      );
      expect(result).toBeErr(uintCV(10152)); // ERR-GAS-COLLECTOR-ONLY
    });

    it("should successfully transfer gas collector role when called by current gas collector", () => {
      // Initial gas collector is address1 (set in deployGasService)
      const { result } = simnet.callPublicFn(
        "gas-service",
        "transfer-gas-collector",
        [gasImplContract, principalCV(address3)],
        address1 // Call from current gas collector
      );
      expect(result).toBeOk(boolCV(true));

      // Verify new gas collector
      const newCollector = simnet.callReadOnlyFn(
        "gas-storage",
        "get-gas-collector",
        [],
        address1
      ).result;
      expect(cvToValue(newCollector)).toBe(address3);
    });

    it("should enforce new gas collector permissions after transfer", () => {
      // First transfer gas collector role from address1 to address3
      simnet.callPublicFn(
        "gas-service",
        "transfer-gas-collector",
        [gasImplContract, principalCV(address3)],
        address1
      );

      // Try to call refund from old gas collector (should fail)
      const refundResult = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(1000),
        ],
        address1 // Old gas collector
      );
      expect(refundResult.result).toBeErr(uintCV(10152)); // ERR-GAS-COLLECTOR-ONLY

      // Try to call collect-fees from old gas collector (should fail)
      const collectResult = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [gasImplContract, principalCV(address1), uintCV(1000)],
        address1 // Old gas collector
      );
      expect(collectResult.result).toBeErr(uintCV(10152)); // ERR-GAS-COLLECTOR-ONLY

      // Verify new gas collector can call these functions
      // First add some balance for testing
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

      // New gas collector should be able to refund
      const newRefundResult = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          gasImplContract,
          bufferCV(Buffer.from("tx-hash")),
          uintCV(0),
          principalCV(address1),
          uintCV(1000),
        ],
        address3 // New gas collector
      );
      expect(newRefundResult.result).toBeOk(boolCV(true));

      // New gas collector should be able to collect fees
      const newCollectResult = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [gasImplContract, principalCV(address1), uintCV(1000)],
        address3 // New gas collector
      );
      expect(newCollectResult.result).toBeOk(boolCV(true));
    });

    it("should prevent setting owner as gas collector", () => {
      const { result } = simnet.callPublicFn(
        "gas-service",
        "transfer-gas-collector",
        [gasImplContract, principalCV(simnet.deployer)], // Try to set owner as collector
        address1
      );
      expect(result).toBeErr(uintCV(10112)); // ERR-OWNER-CANNOT-BE-COLLECTOR
    });

    it("should emit transfer-gas-collector event", () => {
      const { events } = simnet.callPublicFn(
        "gas-service",
        "transfer-gas-collector",
        [gasImplContract, principalCV(address3)],
        address1
      );

      expect(events[0].event).toBe("print_event");
      const printData = cvToValue(events[0].data.value!) as {
        type: { type: string; value: string };
        "new-gas-collector": { type: string; value: string };
      };

      expect(printData.type.value).toBe("transfer-gas-collector");
      expect(printData["new-gas-collector"].value).toBe(address3);
    });
  });
});
