import { sha512_256 } from "@noble/hashes/sha512";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  bufferCV,
  Cl,
  deserializeTransaction,
  listCV,
  tupleCV,
  uintCV,
  callReadOnlyFunction,
} from "@stacks/transactions";
import { intToHex, asciiToBytes } from "@stacks/common";

function tagged_sha512_256(tag: Uint8Array, data: Uint8Array): Uint8Array {
  return sha512_256(new Uint8Array([...tag, ...data]));
}

// https://github.com/stacks-network/stacks-core/blob/eb865279406d0700474748dc77df100cba6fa98e/stacks-common/src/util/hash.rs
class MerkleTree {
  static MERKLE_PATH_LEAF_TAG = new Uint8Array([0x00]);
  static MERKLE_PATH_NODE_TAG = new Uint8Array([0x01]);

  nodes: Uint8Array[][];

  constructor(nodes: Uint8Array[][] = []) {
    this.nodes = nodes;
  }

  static empty(): MerkleTree {
    return new MerkleTree();
  }

  static new(data: Uint8Array[]): MerkleTree {
    if (data.length === 0) {
      return new MerkleTree();
    }

    let leaf_hashes: Uint8Array[] = data.map((buf) =>
      MerkleTree.get_leaf_hash(buf)
    );

    // force even number
    if (leaf_hashes.length % 2 !== 0) {
      const dup = leaf_hashes[leaf_hashes.length - 1];
      leaf_hashes.push(dup);
    }

    let nodes: Uint8Array[][] = [leaf_hashes];

    while (true) {
      const current_level = nodes[nodes.length - 1];
      const next_level: Uint8Array[] = [];

      for (let i = 0; i < current_level.length; i += 2) {
        if (i + 1 < current_level.length) {
          next_level.push(
            MerkleTree.get_node_hash(current_level[i], current_level[i + 1])
          );
        } else {
          next_level.push(current_level[i]);
        }
      }

      // at root
      if (next_level.length === 1) {
        nodes.push(next_level);
        break;
      }

      // force even number
      if (next_level.length % 2 !== 0) {
        const dup = next_level[next_level.length - 1];
        next_level.push(dup);
      }

      nodes.push(next_level);
    }

    return new MerkleTree(nodes);
  }

  static get_leaf_hash(leaf_data: Uint8Array): Uint8Array {
    return tagged_sha512_256(MerkleTree.MERKLE_PATH_LEAF_TAG, leaf_data);
  }

  static get_node_hash(left: Uint8Array, right: Uint8Array): Uint8Array {
    return tagged_sha512_256(
      MerkleTree.MERKLE_PATH_NODE_TAG,
      new Uint8Array([...left, ...right])
    );
  }

  proof(index: number) {
    if (this.nodes.length === 0) {
      return [];
    }
    if (index > this.nodes[0].length - 1) {
      throw new Error("Index out of bounds");
    }
    const depth = this.nodes.length - 1;
    const path = Math.pow(2, depth) + index;

    let proof = [];
    let position = index;
    for (let level = 0; level < depth; ++level) {
      const left = ((1 << level) & path) > 0;
      proof.push(this.nodes[level][position + (left ? -1 : 1)]);
      position = ~~(position / 2);
    }

    return proof;
  }

  root(): Uint8Array {
    if (this.nodes.length === 0) {
      return new Uint8Array(32);
    }
    return this.nodes[this.nodes.length - 1][0];
  }

  pretty_print() {
    let str = "";
    for (let level = this.nodes.length - 1; level >= 0; --level) {
      const whitespace = " ".repeat((this.nodes.length - level - 1) * 2);
      str += this.nodes[level]
        .map((node) => whitespace + bytesToHex(node) + "\n")
        .join("");
    }
    return str;
  }
}

export function proof_path_to_cv(
  tx_index: number,
  hashes: Uint8Array[],
  tree_depth: number
) {
  return tupleCV({
    "tx-index": uintCV(tx_index),
    hashes: listCV(hashes.map(bufferCV)),
    "tree-depth": uintCV(tree_depth),
  });
}


async function getTxInfo({ txId }: { txId: string }) {
  const txInfoRes = await fetch(
    `https://api.testnet.hiro.so/extended/v1/tx/${txId}`
  );
  const txInfoData = await txInfoRes.json();
  return txInfoData;
}

async function verifyDeployment({
  txId,
  deploymentType,
}: {
  txId: string;
  deploymentType: "token-manager" | "nit";
}) {
  const txRaw = await getRawTx({ txId });
  const txInfoData = await getTxInfo({ txId });

  const txIndex = txInfoData.tx_index;
  const blockHeight = txInfoData.block_height;
  const block = new Uint8Array(
    await (
      await fetch(`https://api.testnet.hiro.so/v3/blocks/height/${blockHeight}`)
    ).arrayBuffer()
  );

  const block_version = block.slice(0, 1);
  const chain_length = block.slice(1, 9);
  const burn_spent = block.slice(9, 17);
  const consensus_hash = block.slice(17, 37);
  const parent_block_id = block.slice(37, 69);
  const tx_merkle_root = block.slice(69, 101);
  const state_root = block.slice(101, 133);
  const timestamp = block.slice(133, 141);
  const miner_signature = block.slice(141, 206);
  const signatureCount = Number("0x" + bytesToHex(block.slice(206, 210)));
  const pastSignatures = 210 + signatureCount * 65;
  // const signerBitVecLen = Number("0x" + bytesToHex(block.slice(pastSignatures, pastSignatures + 2)))
  const signerBitVecByteLen = Number(
    "0x" + bytesToHex(block.slice(pastSignatures + 2, pastSignatures + 6))
  );
  const signer_bitvec = block.slice(
    pastSignatures,
    pastSignatures + 6 + signerBitVecByteLen
  );
  const txids = bytesToHex(
    block.slice(pastSignatures + 10 + signerBitVecByteLen)
  )
    .split("808000000004")
    .map((item) => "808000000004" + item)
    .slice(1)
    .map((item) => hexToBytes(deserializeTransaction(item).txid()));

  const tx_merkle_tree = MerkleTree.new(txids);

  const blockHeader = new Uint8Array([
    ...block_version,
    ...chain_length,
    ...burn_spent,
    ...consensus_hash,
    ...parent_block_id,
    ...tx_merkle_root,
    ...state_root,
    ...timestamp,
    ...miner_signature,
    ...signer_bitvec,
  ]);

  const proof = tx_merkle_tree.proof(txIndex);

  const tx = deserializeTransaction(txRaw);
  async function getRawTx({ txId }: { txId: string }) {
    const txRawRes = await fetch(
      `https://api.testnet.hiro.so/extended/v1/tx/${txId}/raw`
    );
    const txRawData = await txRawRes.json();
    const txRaw = txRawData.raw_tx;
    return txRaw;
  }
  
  

  const verifyRes = await callReadOnlyFunction({
    contractAddress: txInfoData.sender_address,
    contractName: "verify-onchain",
    senderAddress: txInfoData.sender_address,
    functionName: `verify-${deploymentType}-deployment`,
    functionArgs: [
      Cl.bufferFromHex(intToHex(txInfoData.nonce, 8)),
      Cl.bufferFromHex(intToHex(txInfoData.fee_rate, 8)),
      Cl.bufferFromHex(tx.auth.spendingCondition.signature.data),
      Cl.buffer(asciiToBytes(tx.payload.contractName.content)),
      Cl.address(txInfoData.sender_address),
      proof_path_to_cv(txIndex, proof, proof.length),
      Cl.uint(txInfoData.block_height),
      Cl.buffer(blockHeader),
    ],
    network: "testnet",
  });
  
  // console.log(txRaw)
  
  return verifyRes
}

const tokenManagerTxId = "0x2d674e58bb2e530bcd75711c9b11726fe22b234dd90fb2ef0ad84201a65c175f";

const nitTxId = "0x0b36e540e1c0d2f45cdcc5a0c2005bc6ebc7c0f219f2e7bbfb8ea0dacfb49ee9"

console.log(Cl.prettyPrint(await verifyDeployment({txId: nitTxId, deploymentType: 'nit'})))


console.log(Cl.prettyPrint(await verifyDeployment({txId: tokenManagerTxId, deploymentType: 'token-manager'})))
