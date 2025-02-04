import { beforeEach, describe, expect, it } from "vitest";
import {
  principalCV,
  contractPrincipalCV,
  stringAsciiCV,
  bufferCV,
  uintCV,
  cvToValue,
  boolCV,
} from "@stacks/transactions";
import { deployGasService } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const deployer = accounts.get("deployer")!;

describe("gas storage tests", () => {
  beforeEach(() => {
    deployGasService(address1)
  })
  describe("implementation contract management", () => {
    it("should have correct initial implementation", () => {
      const { result: initialImpl } = simnet.callReadOnlyFn(
        "gas-storage",
        "get-impl",
        [],
        address1
      );
      expect(cvToValue(initialImpl)).toBe(`${deployer}.gas-impl`);
    });

    it("should prevent unauthorized implementation changes", () => {
      const { result: failedSetImpl } = simnet.callPublicFn(
        "gas-storage",
        "set-impl",
        [contractPrincipalCV(deployer, "new-impl")],
        address1
      );
      expect(failedSetImpl).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
    });
  });

  describe("owner management", () => {
    it("should have correct initial owner", () => {
      const { result: owner } = simnet.callReadOnlyFn(
        "gas-storage",
        "get-owner",
        [],
        address1
      );
      expect(cvToValue(owner)).toBe(deployer);
    });

    it("should prevent unauthorized owner changes", () => {
      const { result } = simnet.callPublicFn(
        "gas-storage",
        "set-owner",
        [principalCV(address2)],
        address1
      );
      expect(result).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
    });

    it("should allow owner change through proxy or impl", () => {
      // Through proxy
      const { result } = simnet.callPublicFn(
        "gas-service",
        "transfer-ownership",
        [
          contractPrincipalCV(deployer, "gas-impl"), // First arg is gas-impl trait
          principalCV(address2), // Second arg is new owner
        ],
        deployer
      );
      expect(result).toBeOk(boolCV(true));

      const { result: newOwner } = simnet.callReadOnlyFn(
        "gas-storage",
        "get-owner",
        [],
        address1
      );
      expect(cvToValue(newOwner)).toBe(address2);
    });
  });

  describe("event emission", () => {
    it("should emit gas paid event correctly", () => {
      const { events } = simnet.callPublicFn(
        "gas-service",
        "pay-native-gas-for-contract-call",
        [
          contractPrincipalCV(deployer, "gas-impl"),
          uintCV(1000),
          principalCV(address1),
          stringAsciiCV("chain"),
          stringAsciiCV("address"),
          bufferCV(Buffer.from("payload")),
          principalCV(address1),
        ],
        address1
      );

      expect(events[0].event).toBe("stx_transfer_event");
      expect(events[0].data.recipient).toBe(`${deployer}.gas-impl`);
      expect(events[0].data.sender).toBe(address1);
      expect(events[0].data.amount).toBe("1000");
    });

    it("should emit gas paid event through pay-native-gas-for-contract-call", () => {
      const { events } = simnet.callPublicFn(
        "gas-service",
        "pay-native-gas-for-contract-call",
        [
          contractPrincipalCV(deployer, "gas-impl"), // gas-impl trait
          uintCV(1000), // amount
          principalCV(address1), // sender
          stringAsciiCV("chain"), // destination-chain
          stringAsciiCV("address"), // destination-address
          bufferCV(Buffer.from("payload")), // payload
          principalCV(address2), // refund-address
        ],
        deployer
      );

      // Check print event exists
      expect(events[1].event).toBe("print_event");
      // Get the value object from the print event
      const printData = cvToValue(events[1].data.value!) as {
        amount: { type: string; value: string };
        "destination-address": { type: string; value: string };
        "destination-chain": { type: string; value: string };
        "payload-hash": { type: string; value: string };
        "refund-address": { type: string; value: string };
        sender: { type: string; value: string };
        type: { type: string; value: string };
      };

      // Check individual fields
      expect(printData.type.value).toBe("native-gas-paid-for-contract-call");
      expect(printData.sender.value).toBe(address1);
      expect(parseInt(printData.amount.value)).toBe(1000);
      expect(printData["refund-address"].value).toBe(address2);
      expect(printData["destination-chain"].value).toBe("chain");
      expect(printData["destination-address"].value).toBe("address");
      expect(printData["payload-hash"].value).toBeDefined();
    });

    it("should emit gas added event through add-native-gas", () => {
      const { events } = simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          contractPrincipalCV(deployer, "gas-impl"),
          uintCV(2000),
          bufferCV(Buffer.from("txhash")),
          uintCV(1),
          principalCV(address1),
        ],
        deployer
      );

      expect(events[1].event).toBe("print_event");
      const printData = cvToValue(events[1].data.value!) as {
        type: { type: string; value: string };
        amount: { type: string; value: string };
        "refund-address": { type: string; value: string };
        "tx-hash": { type: string; value: string };
        "log-index": { type: string; value: string };
      };

      expect(printData.type.value).toBe("native-gas-added");
      expect(parseInt(printData.amount.value)).toBe(2000);
      expect(printData["refund-address"].value).toBe(address1);
      expect(printData["tx-hash"].value).toBeDefined();
      expect(parseInt(printData["log-index"].value)).toBe(1);
    });

    it("should emit refund event through refund", () => {
      // First need to add some balance to the contract
      simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          contractPrincipalCV(deployer, "gas-impl"),
          uintCV(1000),
          bufferCV(Buffer.from("txhash")),
          uintCV(1),
          principalCV(deployer),
        ],
        deployer
      );

      const { events } = simnet.callPublicFn(
        "gas-service",
        "refund",
        [
          contractPrincipalCV(deployer, "gas-impl"),
          bufferCV(Buffer.from("txhash")),
          uintCV(1),
          principalCV(address1),
          uintCV(500),
        ],
        address1
      );

      expect(events[1].event).toBe("print_event");
      const printData = cvToValue(events[1].data.value!) as {
        type: { type: string; value: string };
        "tx-hash": { type: string; value: string };
        "log-index": { type: string; value: string };
        receiver: { type: string; value: string };
        amount: { type: string; value: string };
      };

      expect(printData.type.value).toBe("refunded");
      expect(printData["tx-hash"].value).toBeDefined();
      expect(parseInt(printData["log-index"].value)).toBe(1);
      expect(printData.receiver.value).toBe(address1);
      expect(parseInt(printData.amount.value)).toBe(500);
    });

    it("should emit fees collected event through collect-fees", () => {
      // First need to add some balance to the contract
      simnet.callPublicFn(
        "gas-service",
        "add-native-gas",
        [
          contractPrincipalCV(deployer, "gas-impl"),
          uintCV(1000),
          bufferCV(Buffer.from("txhash")),
          uintCV(1),
          principalCV(deployer),
        ],
        deployer
      );

      const { events } = simnet.callPublicFn(
        "gas-service",
        "collect-fees",
        [
          contractPrincipalCV(deployer, "gas-impl"),
          principalCV(address1),
          uintCV(100),
        ],
        address1
      );

      expect(events[1].event).toBe("print_event");
      const printData = cvToValue(events[1].data.value!) as {
        type: { type: string; value: string };
        receiver: { type: string; value: string };
        amount: { type: string; value: string };
      };

      expect(printData.type.value).toBe("fees-collected");
      expect(printData.receiver.value).toBe(address1);
      expect(parseInt(printData.amount.value)).toBe(100);
    });

    it("should emit transfer ownership event through transfer-ownership", () => {
      const { events } = simnet.callPublicFn(
        "gas-service",
        "transfer-ownership",
        [contractPrincipalCV(deployer, "gas-impl"), principalCV(address2)],
        deployer
      );

      expect(events[0].event).toBe("print_event");
      const printData = cvToValue(events[0].data.value!) as {
        type: { type: string; value: string };
        "new-owner": { type: string; value: string };
      };

      expect(printData.type.value).toBe("transfer-ownership");
      expect(printData["new-owner"].value).toBe(address2);
    });
  });
});
