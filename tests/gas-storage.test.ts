import { describe, expect, it } from "vitest";
import { 
    principalCV, 
    contractPrincipalCV,
    stringAsciiCV,
    bufferCV,
    uintCV, 
    cvToValue
} from "@stacks/transactions";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

describe("gas storage tests", () => {
    it("should only allow proxy to set operator", () => {
        // Direct call from address1 should fail
        const { result } = simnet.callPublicFn(
            "gas-storage", 
            "set-operator", 
            [principalCV(address1)], 
            address1
        );
        expect(result).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
    });

    it("should manage started status", () => {
        // Check initial status
        const { result: initialStatus } = simnet.callReadOnlyFn(
            "gas-storage", 
            "get-is-started", 
            [], 
            address1
        );
        expect(cvToValue(initialStatus)).toBe(false);

        // Direct start call should fail (not from proxy)
        const { result: failedStart } = simnet.callPublicFn(
            "gas-storage", 
            "start", 
            [], 
            address1
        );
        expect(failedStart).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED

        // Start through gas-service setup should succeed
        simnet.callPublicFn(
            "gas-service",
            "setup",
            [principalCV(address1)],
            deployer
        );

        const { result: updatedStatus } = simnet.callReadOnlyFn(
            "gas-storage", 
            "get-is-started", 
            [], 
            address1
        );
        expect(cvToValue(updatedStatus)).toBe(true);
    });

    it("should manage implementation contract", () => {
        const { result: initialImpl } = simnet.callReadOnlyFn(
            "gas-storage", 
            "get-impl", 
            [], 
            address1
        );
        expect(cvToValue(initialImpl)).toBe(`${deployer}.gas-impl`);

        // Direct set-impl call should fail (not from proxy)
        const { result: failedSetImpl } = simnet.callPublicFn(
            "gas-storage",
            "set-impl",
            [contractPrincipalCV(deployer, "new-impl")],
            address1
        );
        expect(failedSetImpl).toBeErr(uintCV(10111)); // ERR-UNAUTHORIZED
    });

    it("should emit events correctly", () => {
        // Setup gas service first
        simnet.callPublicFn(
            "gas-service",
            "setup",
            [principalCV(address1)],
            deployer
        );

        // Test event emission through gas-service
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
                principalCV(address1)
            ],
            address1
        );

        expect(events[0].event).toBe("stx_transfer_event");
        expect(events[0].data.recipient).toBe(`${deployer}.gas-impl`);
        expect(events[0].data.sender).toBe(address1);
        expect(events[0].data.amount).toBe("1000");
    });
}); 