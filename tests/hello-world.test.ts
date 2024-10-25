
import { beforeEach, describe, expect, it } from "vitest";
import { deployGateway, getSigners } from "./util";
import { bufferCVFromString, stringAsciiCV, uintCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;


describe("hello-world tests", () => {
  beforeEach(() => {
    deployGateway(getSigners(0, 10, 1, 10, "1"));
  });

  it("send and execute", () => {
    const destinationChain = 'Destination';
    const destinationAddress = '0x123abc';
    const payload = accounts.get("wallet_3")!;
    
    const { result } = simnet.callPublicFn("hello-world", "set-remote-value", [stringAsciiCV(destinationChain), stringAsciiCV(destinationAddress), bufferCVFromString(payload), uintCV(1_00000)], address1);
    console.log(result)
  });

  // it("shows an example", () => {
  //   const { result } = simnet.callReadOnlyFn("counter", "get-counter", [], address1);
  //   expect(result).toBeUint(0);
  // });
});
