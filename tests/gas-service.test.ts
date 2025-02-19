import { describe, expect, it, beforeEach } from "vitest";
import {
  boolCV,
  bufferCV,
  principalCV,
  stringAsciiCV,
  uintCV,
  contractPrincipalCV,
  cvToValue,
  Cl,
  cvToJSON,
} from "@stacks/transactions";
import { deployGasService, deployGateway, gasImplContract, gatewayImplCV, getSigners, makeProofCV, signersToCv } from "./util";
import { keccak256 } from "./its-utils";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const address2 = accounts.get("wallet_2")!;
const address3 = accounts.get("wallet_3")!;
const deployer = accounts.get("deployer")!;


let sourceChain = stringAsciiCV("ethereum");
let sourceAddress = stringAsciiCV("0xEde3d7425043a1e566D42DCfd6DBec8f2CFB81fB");

const setupGovernance = () => {
  const { result } = simnet.callPublicFn("governance", "setup", [sourceChain, sourceAddress], deployer);
  expect(result).toBeOk(boolCV(true));
}


describe("gas service tests", () => {

  describe("after initialization", () => {
      beforeEach(() => {
        // Deploy gas service with address1 as gas collector
        deployGasService(address1);
      });
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
    beforeEach(() => {
      // Deploy gas service with address1 as gas collector
      deployGasService(address1);
    });
  
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

  it("should be able to collect fees from old implementation", () => {
    const eta = Math.floor(Date.now() / 1000) + 86400;

    const messageId = stringAsciiCV("1");
    const contractAddress = contractPrincipalCV(deployer, 'governance');
  
    setupGovernance();



    const payload = Cl.tuple({
      target: contractPrincipalCV(deployer, 'gas-impl-2'),
      proxy: contractPrincipalCV(deployer, 'gas-service'),
      eta: uintCV(eta),
      type: uintCV(1)
    })
    const payloadHash = bufferCV(keccak256(Cl.serialize(payload)));

    const messages = Cl.list([
      Cl.tuple({
        "source-chain": sourceChain,
        "message-id": messageId,
        "source-address": sourceAddress,
        "contract-address": contractAddress,
        "payload-hash": payloadHash
      })
    ]);

    const { result: impl } = simnet.callReadOnlyFn("gas-storage", "get-impl", [], address1);
    expect(impl).toStrictEqual(Cl.contractPrincipal(accounts.get("deployer")!, "gas-impl"));

    const proofSigners = deployGateway(getSigners(0, 10, 1, 4, "1"));

    const signersHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "get-signers-hash", [signersToCv(proofSigners)], address1);
      return cvToJSON(result).value;
    })();

    const dataHash = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "data-hash-from-messages", [messages], address1);
      return cvToJSON(result).value;
    })();

    const messageHashToSign = (() => {
      const { result } = simnet.callReadOnlyFn("gateway-impl", "message-hash-to-sign", [Cl.bufferFromHex(signersHash), Cl.bufferFromHex(dataHash)], address1);
      return cvToJSON(result).value
    })();

    const proof = makeProofCV(proofSigners, messageHashToSign);

    // approve message on the gateway
    const { result: resultApprove } = simnet.callPublicFn("gateway", "approve-messages", [gatewayImplCV, Cl.buffer(Cl.serialize(messages)), Cl.buffer(Cl.serialize(proof))], address1);
    expect(resultApprove).toBeOk(Cl.list([Cl.ok(Cl.bool(true))]));

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
    // execute on the governance
    const { result: resultExecute } = simnet.callPublicFn("governance", "execute", [gatewayImplCV, sourceChain, messageId, sourceAddress, Cl.buffer(Cl.serialize(payload))], address1);
    expect(resultExecute).toBeOk(Cl.bool(true));

    // check timelock
    const { result: timelock } = simnet.callReadOnlyFn("governance", "get-timelock", [payloadHash], address1);
    expect(timelock).toStrictEqual(payload);

    while (Number(simnet.getBlockTime()) < (eta + 5000)) {
      simnet.mineEmptyBlock()
    }

    // finalize
    const { result: resultFinalize } = simnet.callPublicFn("governance", "finalize", [Cl.contractPrincipal(accounts.get("deployer")!, "gas-service"), Cl.buffer(Cl.serialize(payload))], address1);
    expect(resultFinalize).toBeOk(Cl.bool(true));

    // impl should be updated
    const { result: impl2 } = simnet.callReadOnlyFn("gas-storage", "get-impl", [], address1);
    expect(impl2).toStrictEqual(Cl.contractPrincipal(accounts.get("deployer")!, "gas-impl-2"));

    const newCollectResult = simnet.callPublicFn(
      "gas-impl",
      "collect-fees",
      [principalCV(address1), uintCV(1000)],
      address1
    );
    expect(newCollectResult.result).toBeOk(boolCV(true));
  });
});
