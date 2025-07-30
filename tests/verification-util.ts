import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  Cl,
  deserializeTransaction,
  callReadOnlyFunction as fetchCallReadOnlyFunction,
  StringAsciiCV,
  broadcastTransaction,
  makeContractCall,
  getAddressFromPrivateKey,
  TransactionVersion,
  AnchorMode,
  PostConditionMode,
  makeContractDeploy,
  ClarityVersion,
  SingleSigSpendingCondition,
  BytesReader,
} from "@stacks/transactions";
import { intToHex, asciiToBytes } from "@stacks/common";
import { MerkleTree, proof_path_to_cv } from "./block-hash.ts";
import { sha512_256 } from "@noble/hashes/sha512";
import { keccak_256 } from "@noble/hashes/sha3";

const referenceAddy = "ST237BAVWHZ124P5XWDRJEB40WNRGM9C8A9CK02Q6";
// get new one with Date.now()
const timestamp = 1737466838286;
const tmName = `token-manager-${timestamp}`;
const nitName = `nit-${timestamp}`;
const senderKey =
  "d427253f39b2f4d5649533fa855f16cd7d5cdeee4b4481cf1f83da6053573db901";
// get a new one using randomBytes(32)
const nitSalt =
  "5314c6882a18b49e6d67215b55db4793ac0fc46c2bf8fcdc1802b2af6880b8e4";

const senderAddress = getAddressFromPrivateKey(
  senderKey,
  TransactionVersion.Testnet
);

async function getTxInfo({ txId }: { txId: string }) {
  const txInfoRes = await fetch(
    `https://api.testnet.hiro.so/extended/v1/tx/${txId}`
  );
  const txInfoData = await txInfoRes.json();
  return txInfoData;
}

async function getRawTx({ txId }: { txId: string }) {
  const txRawRes = await fetch(
    `https://api.testnet.hiro.so/extended/v1/tx/${txId}/raw`
  );
  const txRawData = (await txRawRes.json()) as any;
  const txRaw = txRawData.raw_tx;
  return txRaw;
}

export async function getVerificationParams(txId: string) {
  const txRaw = await getRawTx({ txId });
  const txInfoData = (await getTxInfo({ txId })) as any;

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

  const txs = block.slice(pastSignatures + 10 + signerBitVecByteLen);
  const txids = deserializeRawBlockTxs(txs);
  const tx_merkle_tree = MerkleTree.new(txids.map(hexToBytes));

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

  return Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(txInfoData.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(txInfoData.fee_rate, 8)),
    signature: Cl.bufferFromHex(
      (tx.auth.spendingCondition as SingleSigSpendingCondition).signature.data
    ),
    proof: proof_path_to_cv(txIndex, proof, proof.length),
    "tx-block-height": Cl.uint(txInfoData.block_height),
    "block-header-without-signer-signatures": Cl.buffer(blockHeader),
  });
}

export async function setupTm() {
  const tx = await makeContractCall({
    contractAddress: senderAddress,
    contractName: tmName,
    functionName: "setup",
    functionArgs: [
      Cl.address(`${referenceAddy}.sample-sip-010`),
      Cl.uint(2),
      Cl.none(),
    ],
    senderKey,
    network: "testnet",
    fee: 10000,
    anchorMode: AnchorMode.Any,
  });

  const result = await broadcastTransaction(tx, "testnet");
  return result;
}

async function getTmSource() {
  const source = await fetchCallReadOnlyFunction({
    contractAddress: referenceAddy,
    contractName: "verify-onchain",
    functionName: "get-token-manager-source",
    functionArgs: [],
    senderAddress,
    network: "testnet",
  });
  return (source as StringAsciiCV).data;
}
export async function deployTm() {
  const source = await getTmSource();
  const deployTx = await makeContractDeploy({
    contractName: tmName,
    codeBody: source,
    senderKey,
    network: "testnet",
    postConditionMode: PostConditionMode.Allow,
    anchorMode: AnchorMode.Any,
    clarityVersion: ClarityVersion.Clarity3,
    fee: 1000_000,
  });
  const result = await broadcastTransaction(deployTx, "testnet");

  return result;
}

async function getTokenTxId(contract: string) {
  const res = await fetch(
    `https://api.testnet.hiro.so/extended/v1/contract/${contract}`
  );

  const json = (await res.json()) as any;

  return json.tx_id;
}

export async function registerTm() {
  const tmTxHash = await getTokenTxId(`${senderAddress}.${tmName}`);
  const verificationParams = await getVerificationParams(tmTxHash);
  const tx = await makeContractCall({
    contractAddress: referenceAddy,
    contractName: "interchain-token-factory",
    functionName: "register-canonical-interchain-token",
    functionArgs: [
      Cl.address(`${referenceAddy}.interchain-token-factory-impl`),
      Cl.address(`${referenceAddy}.gateway-impl`),
      Cl.address(`${referenceAddy}.gas-impl`),
      Cl.address(`${referenceAddy}.interchain-token-service-impl`),
      Cl.address(`${referenceAddy}.sample-sip-010`),
      Cl.address(`${senderAddress}.${tmName}`),
      verificationParams,
    ],
    senderKey,
    fee: 10000,
    network: "testnet",
    anchorMode: AnchorMode.Any,
  });

  const result = await broadcastTransaction(tx, "testnet");

  return result;
}

export async function verifyTm() {
  const tmTxHash = await getTokenTxId(`${senderAddress}.${tmName}`);
  const verificationParams = await getVerificationParams(tmTxHash);

  const verifyRes = await fetchCallReadOnlyFunction({
    contractAddress: referenceAddy,
    contractName: "verify-onchain",
    senderAddress,
    functionName: `verify-token-manager-deployment`,
    functionArgs: [
      verificationParams.data.nonce,
      verificationParams.data["fee-rate"],
      verificationParams.data["signature"],
      Cl.buffer(asciiToBytes(tmName)),
      Cl.address(senderAddress),
      verificationParams.data["proof"],
      verificationParams.data["tx-block-height"],
      verificationParams.data["block-header-without-signer-signatures"],
    ],
    network: "testnet",
  });

  return verifyRes;
}

export async function transferOp() {
  const burn = "ST000000000000000000002AMW42H";
  const tx = await makeContractCall({
    contractAddress: senderAddress,
    contractName: tmName,
    functionName: "transfer-operatorship",
    functionArgs: [Cl.address(burn)],
    senderKey,
    network: "testnet",
    anchorMode: AnchorMode.Any,
  });

  const result = await broadcastTransaction(tx, "testnet");
  return result;
}

async function getNITSource() {
  const source = await fetchCallReadOnlyFunction({
    contractAddress: referenceAddy,
    contractName: "verify-onchain",
    functionName: "get-nit-source",
    functionArgs: [],
    senderAddress,
    network: "testnet",
  });
  return (source as StringAsciiCV).data;
}

export async function deployNIT() {
  const source = await getNITSource();
  const deployTx = await makeContractDeploy({
    contractName: nitName,
    codeBody: source,
    senderKey,
    network: "testnet",
    clarityVersion: ClarityVersion.Clarity3,
    postConditionMode: PostConditionMode.Allow,
    anchorMode: AnchorMode.Any,
  });
  const result = await broadcastTransaction(deployTx, "testnet");

  return result;
}

function getFactoryInterchainSalt(salt: string, deployer: string) {
  salt = salt.replace(/^0x/, "");

  const interchainTokenSaltPrefix = keccak_256(
    Cl.serialize(Cl.stringAscii("interchain-token-salt"))
  );
  const chainNameHash = keccak_256(Cl.serialize(Cl.stringAscii("stacks")));

  return keccak_256(
    new Uint8Array([
      ...interchainTokenSaltPrefix,
      ...chainNameHash,
      ...Cl.serialize(Cl.principal(deployer)),
      ...hexToBytes(salt),
    ])
  );
}

function getInterChainTokenId(sender: string, salt: string) {
  const interchainTokenIdPrefix = keccak_256(
    Cl.serialize(Cl.stringAscii("its-interchain-token-id"))
  );

  return keccak_256(
    new Uint8Array([
      ...interchainTokenIdPrefix,
      ...Cl.serialize(Cl.principal(sender)),
      ...hexToBytes(salt),
    ])
  );
}

function getInterchainTokenId(salt: Uint8Array, deployer: string) {
  return getInterChainTokenId(
    "ST000000000000000000002AMW42H",
    bytesToHex(getFactoryInterchainSalt(bytesToHex(salt), deployer))
  );
}

export async function setupNIT() {
  const tokenId = getInterchainTokenId(hexToBytes(nitSalt), senderAddress);

  const tx = await makeContractCall({
    contractAddress: senderAddress,
    contractName: nitName,
    functionName: "setup",
    functionArgs: [
      Cl.buffer(tokenId),
      Cl.uint(0),
      Cl.none(),
      Cl.stringAscii("NIT-OCV"),
      Cl.stringAscii("NIV"),
      Cl.uint(6),
      Cl.none(),
      Cl.none(),
    ],
    senderKey,
    network: "testnet",
    fee: 10000,
    anchorMode: AnchorMode.Any,
  });

  const result = await broadcastTransaction(tx, "testnet");
  return result;
}

export async function registerNIT() {
  const nitTxHash = await getTokenTxId(`${senderAddress}.${nitName}`);
  const verificationParams = await getVerificationParams(nitTxHash);
  const tx = await makeContractCall({
    contractAddress: referenceAddy,
    contractName: "interchain-token-factory",
    functionName: "deploy-interchain-token",
    functionArgs: [
      Cl.address(`${referenceAddy}.interchain-token-factory-impl`),
      Cl.address(`${referenceAddy}.gateway-impl`),
      Cl.address(`${referenceAddy}.gas-impl`),
      Cl.address(`${referenceAddy}.interchain-token-service-impl`),
      Cl.bufferFromHex(nitSalt),
      Cl.address(`${senderAddress}.${nitName}`),
      Cl.uint(0),
      Cl.address("ST000000000000000000002AMW42H"),
      verificationParams,
    ],
    senderKey,
    fee: 100000,
    network: "testnet",
    anchorMode: AnchorMode.Any,
  });

  const result = await broadcastTransaction(tx, "testnet");

  return result;
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
  sig: "00a58b3b9e170bf03960a663772ac411b047e7e6e04e9e3344ad3eceafb4d2b97e6374331ef0762585252bb8f4239857852d138fbf6ebcb3bee46df18093d1487f",
  txIndex: 1,
  nonce: 0,
  feeRate: 65536,
  name: "native-interchain-token-1753888793828",
  deployer: "ST2FY0JS5R1CRVJXQ2SAX74TYYQXK90FJZRK4R880",
  txIds: [
    "ea576d1880c4f744e5f00794d4ebd66635d5dc68ed7a8e01bff6bf364f007955",
    "8b7d6b81596cbe38a358436efe738c79e41d42a605ac2ec89418410027b42e37",
  ],
  blockHeight: 3351111,
  blockHeader:
    "00000000000033224700000000574cb970d65be35d5e0b0aaef0c3201b20f6bd90c9210f1b472c4b9b6652f568f8d99d71ca2c2cb8498da4a4fd92f207b8f0a7b44bda561844259699c281cc6d20ba16fb122996a9043c18d872cbc4dc48b77431965b8fd64eb1857327e7aa033165c06b1fe4bb5e2e481c80bd1bdfaa102eb8f97049677100000000688a3e040059e11512413f2d7c9c9535dd9fc1c7fcb490e3943e9fd0c66361ed5a4e32d0174601bf9bf27b57de2cf9bf9a4bd10306258647062eb12dddd563b83b052479a3013500000027ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1f",
};

export const tmMockParams = {
  sig: "00353923b23f465696841cf6b1024e2714c2083587eed99fa207dc8d2b66ed42202e35f135d57f2e7092c72513a0115ffa730596a623eb2eebd2cc2f9a93e5b10c",
  txIndex: 1,
  nonce: 1,
  feeRate: 65536,
  name: "token-manager-1753888793828",
  deployer: "ST2FY0JS5R1CRVJXQ2SAX74TYYQXK90FJZRK4R880",
  txIds: [
    "2306dd88dbca084ed275669308a33a5101cd9d5afaa5f5f79c904f6b7eea5b1d",
    "726ac55806dc4a28bae37781c714761c5a747081d715c7d2f70c536982c55c1b",
  ],
  blockHeight: 3351115,
  blockHeader:
    "00000000000033224b00000000574cb970d65be35d5e0b0aaef0c3201b20f6bd90c9210f1b3b85b91936f32a124ccd62474fc0ce021afc261a99ac13215d79d30d6f6acd35b17cc535bda7dba28375616408b7420ebf6dca4b44d36e560caa169fb5683d2a7bac2acf36fb5246b661183c3c0b2f9a92c7d48faf5aa15eb9e0c4991802f8dd00000000688a3e0f01ee6f4a1ff7317a04c0eca2594668cffecd78183301dcb931b413f1ca9e74d7865e5ff4ceef9253ea050c6ed665bd290c21019172270fa2d7c0736e199f9a710e013500000027ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1f",
};

export const getTokenManagerMockCv = () => {
  simnet.callPublicFn(
    "clarity-stacks",
    "debug-set-block-header-hash",
    [
      Cl.uint(tmMockParams.blockHeight),
      Cl.buffer(sha512_256(hexToBytes(tmMockParams.blockHeader))),
    ],
    simnet.deployer
  );

  const isAlreadyDeployed = simnet.getContractSource(
    `${tmMockParams.deployer}.${tmMockParams.name}`
  );
  if (!isAlreadyDeployed) {
    const tokenManagerSource = simnet.callReadOnlyFn(
      "verify-onchain",
      "get-token-manager-source",
      [],
      simnet.deployer
    ).result as StringAsciiCV;
    simnet.deployContract(
      tmMockParams.name,
      tokenManagerSource.data,
      { clarityVersion: 3 },
      tmMockParams.deployer
    );
  }
  const proof = MerkleTree.new(tmMockParams.txIds.map(hexToBytes)).proof(tmMockParams.txIndex)

  return Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(tmMockParams.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(tmMockParams.feeRate, 8)),
    signature: Cl.bufferFromHex(tmMockParams.sig),
    proof: proof_path_to_cv(
      tmMockParams.txIndex,
      proof,
      proof.length
    ),
    "tx-block-height": Cl.uint(tmMockParams.blockHeight),
    "block-header-without-signer-signatures": Cl.bufferFromHex(
      tmMockParams.blockHeader
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
    simnet.deployer
  );

  const isAlreadyDeployed = simnet.getContractSource(
    `${nitMockParams.deployer}.${nitMockParams.name}`
  );

  if (!isAlreadyDeployed) {
    const nitSource = simnet.getContractSource("native-interchain-token");
    simnet.deployContract(
      nitMockParams.name,
      nitSource!,
      { clarityVersion: 3 },
      nitMockParams.deployer
    );
  }
  const proof = MerkleTree.new(nitMockParams.txIds.map(hexToBytes)).proof(nitMockParams.txIndex)
  return Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(nitMockParams.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(nitMockParams.feeRate, 8)),
    signature: Cl.bufferFromHex(nitMockParams.sig),
    proof: proof_path_to_cv(
      nitMockParams.txIndex,
      proof,
      proof.length
    ),
    "tx-block-height": Cl.uint(nitMockParams.blockHeight),
    "block-header-without-signer-signatures": Cl.bufferFromHex(
      nitMockParams.blockHeader
    ),
  });
};

export function deserializeTransactionCustom(bytesReader: BytesReader) {
  const transaction = deserializeTransaction(bytesReader);
  return { transaction, reader: bytesReader };
}

export function deserializeRawBlockTxs(
  txs: Uint8Array | BytesReader,
  processedTxs: string[] = []
) {
  const { transaction, reader } = deserializeTransactionCustom(
    txs instanceof BytesReader ? txs : new BytesReader(txs)
  );

  processedTxs = processedTxs.concat(transaction.txid());

  if (reader.consumed === reader.source.length) {
    return processedTxs;
  }
  return deserializeRawBlockTxs(reader, processedTxs);
}
