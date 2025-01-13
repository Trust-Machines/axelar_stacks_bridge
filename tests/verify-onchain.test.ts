import { describe, expect, it } from "vitest";
import { exampleTxProof, proof_path_to_cv } from "./block-hash";
import { Cl } from "@stacks/transactions";
import { bytesToHex } from "@noble/hashes/utils";

describe("onchain tx verification", () => {
  it("ensures the example block 443049 and included tx work", () => {
    const { blockHeader, tx_merkle_tree, txids } = exampleTxProof();
    const exampleTxId = "d5d54009cedd77a24e2a43af7ddbbc30292b30f6a1dddd2bc76b40eab527a372"
    const txIndex = txids.findIndex(item => bytesToHex(item) === exampleTxId)
    const proof = tx_merkle_tree.proof(txIndex)

    let result = simnet.callReadOnlyFn("clarity-stacks", "verify-merkle-proof", [
      Cl.bufferFromHex((exampleTxId)),
      Cl.buffer(tx_merkle_tree.root()),
      proof_path_to_cv(txIndex, proof, proof.length)
    ], simnet.deployer)
    expect(result.result).toBeOk(Cl.bool(true))

    result = simnet.callPublicFn("clarity-stacks", 'debug-set-block-header-hash', [
      Cl.uint(443049),
      Cl.bufferFromHex("0xd74b118225d9715ce957f04b0508114dff79f09e2708277e7fd3cb29afb542b5")
    ], simnet.deployer)
    expect(result.result).toBeOk(Cl.bool(true))
    
    result = simnet.callReadOnlyFn("clarity-stacks", "was-tx-mined-compact", [
      Cl.bufferFromHex(exampleTxId),
      proof_path_to_cv(txIndex, proof, proof.length),
      Cl.uint(443049),
      Cl.buffer(blockHeader)
    ], simnet.deployer)
    expect(result.result).toBeOk(Cl.bool(true))
  });

});
