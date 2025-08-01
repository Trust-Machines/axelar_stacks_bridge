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
  const txIds = deserializeRawBlockTxs(txs);
  const tx_merkle_tree = MerkleTree.new(txIds.map(hexToBytes));

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

  const sig = (tx.auth.spendingCondition as SingleSigSpendingCondition)
    .signature.data;
  const verificationParams = Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(txInfoData.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(txInfoData.fee_rate, 8)),
    signature: Cl.bufferFromHex(sig),
    proof: proof_path_to_cv(txIndex, proof, proof.length),
    "tx-block-height": Cl.uint(txInfoData.block_height),
    "block-header-without-signer-signatures": Cl.buffer(blockHeader),
  });
  return {
    verificationParams,
    sig,
    txIndex,
    nonce: txInfoData.nonce,
    feeRate: txInfoData.fee_rate,
    name: txInfoData.smart_contract.contract_id.split(".")[1],
    deployer: txInfoData.sender_address,
    txIds,
    blockHeight: txInfoData.block_height,
    blockHeader: bytesToHex(blockHeader),
  };
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
  const { verificationParams } = await getVerificationParams(tmTxHash);
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
  const { verificationParams } = await getVerificationParams(tmTxHash);

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
  const { verificationParams } = await getVerificationParams(nitTxHash);
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
  const proof = MerkleTree.new(tmMockParams.txIds.map(hexToBytes)).proof(
    tmMockParams.txIndex
  );

  return Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(tmMockParams.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(tmMockParams.feeRate, 8)),
    signature: Cl.bufferFromHex(tmMockParams.sig),
    proof: proof_path_to_cv(tmMockParams.txIndex, proof, proof.length),
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
  const proof = MerkleTree.new(nitMockParams.txIds.map(hexToBytes)).proof(
    nitMockParams.txIndex
  );
  return Cl.tuple({
    nonce: Cl.bufferFromHex(intToHex(nitMockParams.nonce, 8)),
    "fee-rate": Cl.bufferFromHex(intToHex(nitMockParams.feeRate, 8)),
    signature: Cl.bufferFromHex(nitMockParams.sig),
    proof: proof_path_to_cv(nitMockParams.txIndex, proof, proof.length),
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

export const nitMockParams = {
  sig: "01e8b25f3e05c2e27c1ebab52ee795d72480b33240d921225c8f6e053187d0991e71bdf3f90c485d0496522a3133e396283398da1d424787d4cc62aef7bd8e152e",
  txIndex: 0,
  nonce: 11,
  feeRate: "65536",
  name: "native-interchain-token-1754052986324",
  deployer: "ST2FY0JS5R1CRVJXQ2SAX74TYYQXK90FJZRK4R880",
  txIds: ["db93df059fa14f52a65d310f14a2cd2ecc33f1122273ef1cefb5bffee8253e98"],
  blockHeight: 3398974,
  blockHeader:
    "00000000000033dd3e00000000581ba2308e861bcb0015b34de6a7b76dd38650cc53e3aea154f53c523beb310c753cfbe9fac5e8f3abfd615d22b7f5475f2c6684b1c60d2a536c7a01e1963246da427d41a76e0b3bc6f8af8a46e0b2c3cb7acd1a45bff15b7f707ea3880f76782114dbb2a16b04e1b997a52d183687bd1a8718f0c836d2d200000000688cb97b01c024dfd471a871db5e5193d929be7710896f5b22f08497f0bc7b6a654541725458d9b8ea285386ac6e74a632c1d05619ea3630aa5a0da5dbbee9e037c6e8cad9013400000027ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0f",
};

export const tmMockParams = {
  sig: "01764150d2266dab0afde9f3e603290b13616b565c42e0b5160fe7e417ce7eac5e6178d787d2283d817302b5b66e4e4909be1c0195425cdbc345c27a2f5ad213ed",
  txIndex: 1,
  nonce: 12,
  feeRate: "65536",
  name: "token-manager-1754052986324",
  deployer: "ST2FY0JS5R1CRVJXQ2SAX74TYYQXK90FJZRK4R880",
  txIds: [
    "47b85e229d46f8d4d7e206736768432bad42e09abc1715247adadc5f4ad79ec2",
    "b7d05f27f869e8304cfe780c8482629cdc2462115e4434887d4f8a341f4eae67",
  ],
  blockHeight: 3398977,
  blockHeader:
    "00000000000033dd4100000000581ba2308e861bcb0015b34de6a7b76dd38650cc53e3aea11fecd987bc6ff9dcf5d82154b9dbba96c600f7e197b38c78a1fa281623d55a1dfc57046410ca793e3112f39a98a8d4f85d34a98a354853cb9000017b109918ca9c579e2403bf275a36ebd5a8dc41ccb6d30980653e5ebf2a146adad504007e3600000000688cb9850165b5288378b6e83ee9bfade16ad9bcdad20d158fda788b74679561284e33afc9563d7a80fb7e4c17bdf8178acb8ce9ce188c62321b03fe10269569b82f6bee46013400000027ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0f",
};
