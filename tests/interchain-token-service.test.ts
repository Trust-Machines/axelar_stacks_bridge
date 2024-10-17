import { contractPrincipalCV, listCV, standardPrincipalCV, stringAsciiCV, trueCV, tupleCV, uintCV } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;
const deployer = accounts.get("deployer")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

function setupService() {
  expect(simnet.callPublicFn('interchain-token-service', 'setup', [
    stringAsciiCV('interchain-token-service'),
    contractPrincipalCV(deployer, 'interchain-token-factory'),
    contractPrincipalCV(deployer, 'gateway'),
    contractPrincipalCV(deployer, 'gas-service'),
    standardPrincipalCV(deployer),
    listCV([
      tupleCV({
        'chain-name': stringAsciiCV("ethereum"),
        address: stringAsciiCV('0x00')
      })
    ])
  ], deployer).result).toBeOk(trueCV())
}
describe("Interchain Token Service", () => {
  beforeEach(setupService)
  describe("Owner functions", () => {
    it("Should revert on set pause status when not called by the owner", () => {
      expect(simnet.callPublicFn('interchain-token-service', 'set-paused', [trueCV()], address1).result).toBeErr(uintCV(1051))
    });

    it("Should revert on set trusted address when not called by the owner", () => {
      expect(simnet.callPublicFn('interchain-token-service','set-trusted-address', [
        stringAsciiCV('ethereum'),
        stringAsciiCV('0x00')
      ], address1).result).toBeErr(uintCV(1051))
    });

    it("Should set trusted address", () => {
      expect(simnet.callPublicFn('interchain-token-service','set-trusted-address', [
        stringAsciiCV('ethereum'),
        stringAsciiCV('0x00')
      ], deployer).result).toBeOk(trueCV())
    });

    it("Should revert on remove trusted address when not called by the owner", () => {
      expect(simnet.callPublicFn('interchain-token-service','remove-trusted-address', [
        stringAsciiCV('ethereum'),
      ], address1).result).toBeErr(uintCV(1051))
    });

    it("Should remove trusted address", () => {
      expect(simnet.callPublicFn('interchain-token-service','remove-trusted-address', [
        stringAsciiCV('ethereum'),
      ], deployer).result).toBeOk(trueCV())
    });
  });

  describe("Deploy and Register Interchain Token", () => {
    it("Should register an interchain token", () => {});

    it("Should revert when registering an interchain token as a lock/unlock for a second time", () => {});

    it("Should revert when registering an interchain token when service is paused", () => {});
  });
});
