import { 
    boolCV,
    bufferCV,
    principalCV, 
    stringAsciiCV, 
    uintCV,
  } from "@stacks/transactions";
  import { describe, expect, it } from "vitest";
import { deployGasService, gasImplContract } from "./util";
  
  const accounts = simnet.getAccounts();
  const address1 = accounts.get("wallet_1")!;
  const deployer = accounts.get("deployer")!;
  
  
  describe("gas-impl tests", () => {
    describe("initialization", () => {
      it("should work correctly after setup", () => {
        deployGasService();
        
        // Test a valid proxy call
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
    });
  
    it("proxy only public functions", () => {
      // Test direct calls to pay-native-gas-for-contract-call
      expect(
        simnet.callPublicFn(
          "gas-impl", 
          "pay-native-gas-for-contract-call", 
          [
            uintCV(1000),
            principalCV(address1),
            stringAsciiCV("destination-chain"),
            stringAsciiCV("destination-address"),
            bufferCV(Buffer.from("payload")),
            principalCV(address1)
          ], 
          address1
        ).result
      ).toBeErr(uintCV(10111)); // err-unauthorized
  
      // Test direct calls to collect-fees
      expect(
        simnet.callPublicFn(
          "gas-impl",
          "collect-fees",
          [
            principalCV(address1),
            uintCV(1000)
          ],
          address1
        ).result
      ).toBeErr(uintCV(10111)); // err-unauthorized
    });
  
    it("proxy only public functions (refund)", () => {
      // Test direct calls to refund
      expect(
        simnet.callPublicFn(
          "gas-impl",
          "refund",
          [
            bufferCV(Buffer.from("tx-hash")),
            uintCV(0), // log-index
            principalCV(address1),
            uintCV(1000)
          ],
          address1
        ).result
      ).toBeErr(uintCV(10111)); // err-unauthorized
    });
  
    it("should allow reading balance", () => {
      // Test get-balance function
      const { result } = simnet.callReadOnlyFn(
        "gas-impl",
        "get-balance",
        [],
        deployer
      );
      expect(result).toBeOk(uintCV(0));
    });
  });