import { describe, expect, it } from "vitest";
import { exampleTxProof, MerkleTree, proof_path_to_cv } from "./block-hash";
import { Cl, StringAsciiCV } from "@stacks/transactions";
import { bytesToHex } from "@noble/hashes/utils";
import {asciiToBytes, hexToBytes, intToHex} from "@stacks/common"
import { nitMockParams, tmMockParams } from "./verification-util";
import { sha512_256 } from "@noble/hashes/sha512";

describe("onchain tx verification", () => {
  it("ensures the example block 443049 and included tx work", () => {
    const { blockHeader, tx_merkle_tree, txids } = exampleTxProof();
    const exampleTxId =
      "d5d54009cedd77a24e2a43af7ddbbc30292b30f6a1dddd2bc76b40eab527a372";
    const txIndex = txids.findIndex((item) => bytesToHex(item) === exampleTxId);
    const proof = tx_merkle_tree.proof(txIndex);

    let result = simnet.callReadOnlyFn(
      "clarity-stacks",
      "verify-merkle-proof",
      [
        Cl.bufferFromHex(exampleTxId),
        Cl.buffer(tx_merkle_tree.root()),
        proof_path_to_cv(txIndex, proof, proof.length),
      ],
      simnet.deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));

    result = simnet.callPublicFn(
      "clarity-stacks",
      "debug-set-block-header-hash",
      [
        Cl.uint(443049),
        Cl.bufferFromHex(
          "0xd74b118225d9715ce957f04b0508114dff79f09e2708277e7fd3cb29afb542b5"
        ),
      ],
      simnet.deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));

    result = simnet.callReadOnlyFn(
      "clarity-stacks",
      "was-tx-mined-compact",
      [
        Cl.bufferFromHex(exampleTxId),
        proof_path_to_cv(txIndex, proof, proof.length),
        Cl.uint(443049),
        Cl.buffer(blockHeader),
      ],
      simnet.deployer
    );
    expect(result.result).toBeOk(Cl.bool(true));
  });

  it("ensures that token-manager deployment is correct sample testnet blocks", () => {
    simnet.callPublicFn(
      "clarity-stacks",
      "debug-set-block-header-hash",
      [
        Cl.uint(tmMockParams.blockHeight),
        Cl.buffer(sha512_256(
          hexToBytes(tmMockParams.blockHeader)
        ))
      ],
      simnet.deployer
    );

    const tree = MerkleTree.new([
      hexToBytes(tmMockParams.txId),
    ])

    const proof = tree.proof(tmMockParams.txIndex)

    const {result} = simnet.callReadOnlyFn(
      "verify-onchain",
      "verify-token-manager-deployment",
      [
        Cl.bufferFromHex(intToHex(tmMockParams.nonce, 8)),
        Cl.bufferFromHex(intToHex(tmMockParams.feeRate, 8)),
        Cl.bufferFromHex(tmMockParams.sig),
        Cl.buffer(asciiToBytes(tmMockParams.name)),
        Cl.address(tmMockParams.deployer),
        proof_path_to_cv(tmMockParams.txIndex, proof, proof.length),
        Cl.uint(tmMockParams.blockHeight),
        Cl.bufferFromHex(tmMockParams.blockHeader),
      ],
      simnet.deployer
    )

    expect(result).toBeOk(Cl.bool(true))
  });

  it("ensures that native interchain token deployment is correct sample testnet blocks", () => {
    simnet.callPublicFn(
      "clarity-stacks",
      "debug-set-block-header-hash",
      [
        Cl.uint(nitMockParams.blockHeight),
        Cl.buffer(sha512_256(hexToBytes(nitMockParams.blockHeader)))
      ],
      simnet.deployer
    );

    const tree = MerkleTree.new([
      hexToBytes(nitMockParams.txId),
    ])

    const proof = tree.proof(nitMockParams.txIndex)

    const {result} = simnet.callReadOnlyFn(
      "verify-onchain",
      "verify-nit-deployment",
      [
        Cl.bufferFromHex(intToHex(nitMockParams.nonce, 8)),
        Cl.bufferFromHex(intToHex(nitMockParams.feeRate, 8)),
        Cl.bufferFromHex(nitMockParams.sig),
        Cl.buffer(asciiToBytes(nitMockParams.name)),
        Cl.address(nitMockParams.deployer),
        proof_path_to_cv(nitMockParams.txIndex, proof, proof.length),
        Cl.uint(nitMockParams.blockHeight),
        Cl.bufferFromHex(nitMockParams.blockHeader),
      ],
      simnet.deployer
    )

    expect(result).toBeOk(Cl.bool(true))
  });

  it("should export the NIT contract source", async () => {
    const {result} = simnet.callReadOnlyFn("verify-onchain", "get-nit-source", [], simnet.deployer)

    expect((result as StringAsciiCV).data.length).toBeGreaterThan(0)
  });
  it("should export the token manager contract source", async () => {
    const {result} = simnet.callReadOnlyFn("verify-onchain", "get-token-manager-source", [], simnet.deployer)
    expect((result as StringAsciiCV).data.length).toBeGreaterThan(0)
  });
});
