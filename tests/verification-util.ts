import {
  getAddressFromPrivateKey,
  pubKeyfromPrivKey,
  // Cl,
  makeContractDeploy,
  AuthType,
  AnchorMode,
  PostConditionMode,
  serializeLPList,
  // StacksWireType,
  createLPList,
  PayloadType,
  ClarityVersion,
  AddressHashMode,
  PubKeyEncoding,
  SingleSigSpendingCondition,
} from "@stacks/transactions";
import {
  asciiToBytes,
  bytesToHex,
  hexToBytes,
  intToHex,
  TransactionVersion,
} from "@stacks/common";
// import { sha512_256 } from '@noble/hashes/sha512';
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import {
  StacksTestnet,
  StacksMainnet,
  StacksNetworkName,
} from "@stacks/network";
const STACKS_MAINNET = new StacksMainnet();
const STACKS_TESTNET = new StacksTestnet();

let network: StacksNetworkName = "mainnet";
network = "testnet" as StacksNetworkName;
const privateKey =
  "753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601";
const publicKey = pubKeyfromPrivKey(privateKey);
const address = getAddressFromPrivateKey(
  privateKey,
  network === "mainnet"
    ? TransactionVersion.Mainnet
    : TransactionVersion.Testnet
);

const codeBody = `(define-read-only (hi)\n  \"hi\"\n)\n`;
const nonce = 0;
const fee = 10_000;
const contractName = "contract-0";

const tx = await makeContractDeploy({
  address,
  codeBody,
  contractName,
  senderKey: privateKey,
  nonce,
  fee,
  network,
  postConditionMode: PostConditionMode.Allow,
  clarityVersion: ClarityVersion.Clarity3,
  anchorMode: AnchorMode.Any,
});

let version = TransactionVersion.Mainnet;

if (network === "testnet") {
  version = TransactionVersion.Testnet;
}

let chainId = STACKS_MAINNET.chainId;
if (network === "testnet") {
  chainId = STACKS_TESTNET.chainId;
}
const authType = AuthType.Standard;
const hashMode = AddressHashMode.SerializeP2PKH;
const pubkeyHash = bytesToHex(ripemd160(sha256(publicKey.data)));
const sig = (tx.auth.spendingCondition as SingleSigSpendingCondition).signature
  .data;
const anchorMode = AnchorMode.Any;
const postCondtionMode = PostConditionMode.Allow;
const postConditions = bytesToHex(serializeLPList(createLPList([])));
// Versioned smart contract
const payloadType = PayloadType.VersionedSmartContract;
const clarityVersion = ClarityVersion.Clarity3;

const pubKeyEncoding = PubKeyEncoding.Compressed;
console.log(bytesToHex(tx.serialize()));
// console.log(sig)

console.log(
  // 1
  intToHex(version, 1) +
    // 4
    intToHex(chainId, 4) +
    // 1
    intToHex(authType, 1) +
    // 1
    intToHex(hashMode, 1) +
    // 20
    pubkeyHash +
    // 8
    intToHex(nonce, 8) +
    // 8
    intToHex(fee, 8) +
    // 1
    intToHex(pubKeyEncoding, 1) +
    // 65
    sig +
    // 1
    intToHex(anchorMode, 1) +
    // 1
    intToHex(postCondtionMode, 1) +
    // 4
    postConditions +
    // 1
    intToHex(payloadType, 1) +
    // 1
    intToHex(clarityVersion, 1) +
    // 1
    intToHex(contractName.length, 1) +
    // variable
    bytesToHex(asciiToBytes(contractName)) +
    // 4
    intToHex(codeBody.length, 4) +
    // variable
    bytesToHex(asciiToBytes(codeBody)) +
    ""
);
