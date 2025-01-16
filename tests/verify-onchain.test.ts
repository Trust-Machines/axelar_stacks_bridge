import { describe, expect, it } from "vitest";
import { exampleTxProof, MerkleTree, proof_path_to_cv } from "./block-hash";
import { Cl, StringAsciiCV } from "@stacks/transactions";
import { bytesToHex } from "@noble/hashes/utils";
import {asciiToBytes, hexToBytes, intToHex} from "@stacks/common"

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
    const tokenManagerTxId =
      "0x2d674e58bb2e530bcd75711c9b11726fe22b234dd90fb2ef0ad84201a65c175f";
    const blockHeight = 49460;
    simnet.callPublicFn(
      "clarity-stacks",
      "debug-set-block-header-hash",
      [
        Cl.uint(blockHeight),
        Cl.bufferFromHex("0xf722a4d26d1591ac921b848fc6fd90116eb2b33dae90d1170606c5ddc7bede54")
      ],
      simnet.deployer
    );

    const tree = MerkleTree.new([
      hexToBytes(tokenManagerTxId),
      hexToBytes("0xa11149e1f059f63fe75e225e053076af41b408f561cdfa9f87e288719f1a4df3"),
    ])

    const proof = tree.proof(0)

    const {result} = simnet.callReadOnlyFn(
      "verify-onchain",
      "verify-token-manager-deployment",
      [
        Cl.bufferFromHex(intToHex(20, 8)),
        Cl.bufferFromHex(intToHex(12102, 8)),
        Cl.bufferFromHex("01b27872b1fe18e300315b80296871fdadfb79c56eff408e2d527e60b075f9fbc65464d82be23513b9cb8b69028014107a50524108184c6199ea76fec177bc9b2c"),
        Cl.buffer(asciiToBytes("token-man")),
        Cl.address("STANVMQYPJMAB5TA226FFHSXJS2BQKPKSV3RKHYE"),
        proof_path_to_cv(0, proof, proof.length),
        Cl.uint(blockHeight),
        Cl.bufferFromHex("00000000000000c13400000000055ed1205dead82ff8a7b9a4f21f7e2893f39207d65b32cef1e164b2f051601444af6d9617f28648d2692626ce6d14943c147a8da4acffb09cff4db57caf54c9caab67adff5082d4bfaa62a4ab616e696defe70390e28802dd1eefb6231139a156daf990b92fc3189cbcf22a54213d8dada49c93fd4f0c6e000000006787c68601edabda3a95fc8029534dd3822169c3e3d439161d88a4a8b0f9726bec000b6c6f584a819050c6d8e56bacb31a3e432ffa884b292d72d461e33f3618301e11a136013700000027ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f"),
      ],
      simnet.deployer
    )

    expect(result).toBeOk(Cl.bool(true))
  });

  it("ensures that native interchain token deployment is correct sample testnet blocks", () => {
    const nitTxId =
      "0x0b36e540e1c0d2f45cdcc5a0c2005bc6ebc7c0f219f2e7bbfb8ea0dacfb49ee9";
    const blockHeight = 49528;
    simnet.callPublicFn(
      "clarity-stacks",
      "debug-set-block-header-hash",
      [
        Cl.uint(blockHeight),
        Cl.bufferFromHex("0x4013bf18effed0f56cfa4b252039b284319de9e0362a7050ccfcf1839a83ded3")
      ],
      simnet.deployer
    );

    const tree = MerkleTree.new([
      hexToBytes("0xbf3335e9256d5d1036f6a91c50b46909ace17edb73ce12852dc93c0800fe60da"),
      hexToBytes(nitTxId),
    ])

    const proof = tree.proof(1)

    const {result} = simnet.callReadOnlyFn(
      "verify-onchain",
      "verify-nit-deployment",
      [
        Cl.bufferFromHex(intToHex(21, 8)),
        Cl.bufferFromHex(intToHex(12740, 8)),
        Cl.bufferFromHex("01cb787de4b8e95bf74be3fd1a9ba556b3c1b862581191ca9ff44d8a33be25faeb79f3e4b730df4a12d33a2324dd8f4cfff406d797078988db6ef1480db76ead37"),
        Cl.buffer(asciiToBytes("nit")),
        Cl.address("STANVMQYPJMAB5TA226FFHSXJS2BQKPKSV3RKHYE"),
        proof_path_to_cv(1, proof, proof.length),
        Cl.uint(blockHeight),
        Cl.bufferFromHex("00000000000000c1780000000005627aa05793d40096982fedd27182956bb1f32c831024c42f06c622f00eaae294062061257d961dd82f06dcd6e9ff039e212e2282167afc343a59a80e96b21f394cdd980572bb324c61534c678d92f15a3b2084ce530c2406f9f80be3c071a39fa7f9553481baa6125ce5bf56829b036d20c85ad590f9f8000000006787d22400d3424a819d77e6526282063c3393e196f52baab9c69e87a1c8b4cf058dbc1eaf567775943946f0c99c0fc8f0cdd4b7da6aba5831585a9d26f6e68bd5c1496d1a013700000027ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f"),
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
