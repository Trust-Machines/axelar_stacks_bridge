
import { listCV, principalCV, stringAsciiCV, tupleCV, uintCV } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
import { gatewayImplCV } from "./util";
import { bufferFromHex } from "@stacks/transactions/dist/cl";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("gateway storage tests", () => {
  it("proxy/impl only setters", () => {
    expect(simnet.callPublicFn("gateway-storage", "start", [], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-impl", [gatewayImplCV], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-operator", [principalCV(address1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-epoch", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-last-rotation-timestamp", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-signer-hash-by-epoch", [uintCV(1), bufferFromHex("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-epoch-by-signer-hash", [bufferFromHex("0x00"), uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-previous-signers-retention", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-domain-separator", [bufferFromHex("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-minimum-rotation-delay", [uintCV(1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "insert-message", [bufferFromHex("0x00"), bufferFromHex("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "set-message", [bufferFromHex("0x00"), bufferFromHex("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-contract-call", [principalCV(address1), stringAsciiCV(""), stringAsciiCV(""), bufferFromHex("0x00"), bufferFromHex("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-message-approved", [bufferFromHex("0x00"), tupleCV({ "source-chain": stringAsciiCV(""), "message-id": stringAsciiCV(""), "source-address": stringAsciiCV(""), "contract-address": principalCV(address1), "payload-hash": bufferFromHex("0x00") })], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-message-executed", [bufferFromHex("0x00"), stringAsciiCV(""), stringAsciiCV("")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-signers-rotated", [uintCV(1), tupleCV({ "signers": listCV([]), "threshold": uintCV(1), "nonce": bufferFromHex("0x00") }), bufferFromHex("0x00")], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-transfer-operatorship", [principalCV(address1)], address1).result).toBeErr(uintCV(10111));
    expect(simnet.callPublicFn("gateway-storage", "emit-str", [stringAsciiCV("")], address1).result).toBeErr(uintCV(10111));
  });
});
