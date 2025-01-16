import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  Cl,
  deserializeTransaction,
  callReadOnlyFunction,
} from "@stacks/transactions";
import { intToHex, asciiToBytes } from "@stacks/common";
import { MerkleTree, proof_path_to_cv } from "./block-hash.ts";


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
