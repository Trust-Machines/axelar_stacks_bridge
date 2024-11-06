
import { bufferCVFromString, listCV, principalCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { gatewayImplCV } from "./util";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("gateway storage tests", () => {
  it("proxy/impl only setters", () => {
    expect(simnet.callPublicFn("gateway-storage", "start", [], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-impl", [gatewayImplCV], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-operator", [principalCV(address1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-epoch", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-last-rotation-timestamp", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-signer-hash-by-epoch", [uintCV(1), bufferCVFromString("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-epoch-by-signer-hash", [bufferCVFromString("0x00"), uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-previous-signers-retention", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-domain-separator", [bufferCVFromString("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-minimum-rotation-delay", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "insert-message", [bufferCVFromString("0x00"), bufferCVFromString("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-message", [bufferCVFromString("0x00"), bufferCVFromString("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-contract-call", [principalCV(address1), stringAsciiCV(""), stringAsciiCV(""), bufferCVFromString("0x00"), bufferCVFromString("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-message-approved", [bufferCVFromString("0x00"), tupleCV({ "source-chain": stringAsciiCV(""), "message-id": stringAsciiCV(""), "source-address": stringAsciiCV(""), "contract-address": principalCV(address1), "payload-hash": bufferCVFromString("0x00") })], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-message-executed", [bufferCVFromString("0x00"), stringAsciiCV(""), stringAsciiCV("")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-signers-rotated", [uintCV(1), tupleCV({ "signers": listCV([]), "threshold": uintCV(1), "nonce": bufferCVFromString("0x00") }), bufferCVFromString("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-transfer-operatorship", [principalCV(address1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-str", [stringAsciiCV("")], address1).result).toBeErr(uintCV(10111));
  });
});
