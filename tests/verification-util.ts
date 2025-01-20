import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  Cl,
  deserializeTransaction,
  callReadOnlyFunction,
  StringAsciiCV,
} from "@stacks/transactions";
import { intToHex, asciiToBytes, intToBytes } from "@stacks/common";
import { MerkleTree, proof_path_to_cv } from "./block-hash.ts";
import { sha512_256 } from "@noble/hashes/sha512";

async function getTxInfo({ txId }: { txId: string }) {
  const txInfoRes = await fetch(
    `https://api.testnet.hiro.so/extended/v1/tx/${txId}`,
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
    ).arrayBuffer(),
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
    "0x" + bytesToHex(block.slice(pastSignatures + 2, pastSignatures + 6)),
  );
  const signer_bitvec = block.slice(
    pastSignatures,
    pastSignatures + 6 + signerBitVecByteLen,
  );
  const txids = bytesToHex(
    block.slice(pastSignatures + 10 + signerBitVecByteLen),
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
      `https://api.testnet.hiro.so/extended/v1/tx/${txId}/raw`,
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

  return verifyRes;
}

// const tokenManagerTxId =
//   "0x2d674e58bb2e530bcd75711c9b11726fe22b234dd90fb2ef0ad84201a65c175f";

// const nitTxId =
//   "0x0b36e540e1c0d2f45cdcc5a0c2005bc6ebc7c0f219f2e7bbfb8ea0dacfb49ee9";

// console.log(
//   Cl.prettyPrint(
//     await verifyDeployment({ txId: nitTxId, deploymentType: "nit" })
//   )
// );

// console.log(
//   Cl.prettyPrint(
//     await verifyDeployment({
//       txId: tokenManagerTxId,
//       deploymentType: "token-manager",
//     })
//   )
// );

export const nitMockParams = {
  nonce: 1,
  feeRate: 0x10000,
  sig: "01686d4f7464d257aae568e477fb370662019d9c9c0d688c6413f4a6290e881bca0ec50641ac944387e4ef6131f44c5e0e867b06a6a1d07bd3faff37540616b295",
  name: "nit",
  deployer: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
  txIndex: 0,
  txId: "43f83df861cc2a006b96b490150ead8d29d9992217b9cb7cdcf9f704ac528165",
  blockHeight: 41,
  blockHeader:
    "00000000000000002900000000000be6e0f5f88b84818b9838bb688397cb05d30b4498c3d8f7f3015bd6763cb423e8d49718bd65c7038987e63417e0cdb4fd477e66dd4bdd107b15060e27127662fab0aadb4782213ccbd407f72f0e4d9a19be5c0872db6b2a7bd3e7b736528303d9f6cffa7da8e5adbfe2cece992d67aee1e98ff3eb770300000000678a913a00f570ad2d64ef27da92f2ffd479cd54651fede131c7ae43a947fa031f4b270ee6551e7d5a4fee7839c61c7914134688e97007cd72e22205a328f7c8800448a2ef001000000002ffff",
};

export const tmMockParams = {
  nonce: 2,
  feeRate: 0x10000,
  sig: "001f98fdeef5cd982640f291e4d3d60965a0e92e85deca33435f77e7a640258fe21416b0f7f73b0a5fab5fbd19314117c7ccb48f7cf9e95a47e79b2a0c66df46cf",
  name: "token-man",
  deployer: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
  txIndex: 0,
  txId: "4521dfedd576b0ec0ed0130e8ac0969b2c867982de7679ae8dcd3f253aff05b8",
  blockHeight: 45,
  blockHeader:
    "00000000000000002d00000000000cd140f712a586e3ed8a31efbedac9eaf32365811b344c92dd31a04d216d61031e92b5a684ade626ba8825c45cb2f60c6ccfa4a025d22a07b58cef2bae4f31e1dae2a323ca6520226cfb6221064ad2227dcdb249922cd7d7ebff01c1afeb1e7ed29d24fa1a537e72c958d5a7e32c040d6d571669e13e3100000000678a914a012519a88ce6b1dc316424887215f51db0c19e52070dacea473596588513d40c8533f8ef32ef370034bf65a275e436c94ebb90af5b4f99529858a67ef1211035cd001000000002ffff",
};

export const getTokenManagerMockCv = () => {
  simnet.callPublicFn(
    "clarity-stacks",
    "debug-set-block-header-hash",
    [
      Cl.uint(tmMockParams.blockHeight),
      Cl.buffer(sha512_256(hexToBytes(tmMockParams.blockHeader))),
    ],
    simnet.deployer,
  );

  const isAlreadyDeployed = simnet.getContractSource(
    `${tmMockParams.deployer}.${tmMockParams.name}`,
  );
  if (!isAlreadyDeployed) {
    const tokenManagerSource = simnet.callReadOnlyFn(
      "verify-onchain",
      "get-token-manager-source",
      [],
      simnet.deployer,
    ).result as StringAsciiCV;
    simnet.deployContract(
      tmMockParams.name,
      tokenManagerSource.data,
      { clarityVersion: 3 },
      tmMockParams.deployer,
    );
  }

  return Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(tmMockParams.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(tmMockParams.feeRate, 8)),
    signature: Cl.bufferFromHex(tmMockParams.sig),
    proof: proof_path_to_cv(
      0,
      MerkleTree.new([hexToBytes(tmMockParams.txId)]).proof(0),
      1,
    ),
    "tx-block-height": Cl.uint(tmMockParams.blockHeight),
    "block-header-without-signer-signatures": Cl.bufferFromHex(
      tmMockParams.blockHeader,
    ),
  });
};

export const getNITMockCv = () => {
  simnet.callPublicFn(
    "clarity-stacks",
    "debug-set-block-header-hash",
    [
      Cl.uint(nitMockParams.blockHeight),
      Cl.buffer(sha512_256(hexToBytes(nitMockParams.blockHeader))),
    ],
    simnet.deployer,
  );

  const isAlreadyDeployed = simnet.getContractSource(
    `${nitMockParams.deployer}.${nitMockParams.name}`,
  );

  if (!isAlreadyDeployed) {
    const nitSource = simnet.getContractSource("native-interchain-token");
    simnet.deployContract(
      nitMockParams.name,
      nitSource!,
      { clarityVersion: 3 },
      nitMockParams.deployer,
    );
  }
  return Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(nitMockParams.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(nitMockParams.feeRate, 8)),
    signature: Cl.bufferFromHex(nitMockParams.sig),
    proof: proof_path_to_cv(
      0,
      MerkleTree.new([hexToBytes(nitMockParams.txId)]).proof(0),
      1,
    ),
    "tx-block-height": Cl.uint(nitMockParams.blockHeight),
    "block-header-without-signer-signatures": Cl.bufferFromHex(
      nitMockParams.blockHeader,
    ),
  });
};
