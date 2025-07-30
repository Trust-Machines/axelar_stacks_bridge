import {
  AddressVersion,
  AnchorMode,
  broadcastTransaction,
  type BufferCV,
  makeContractDeploy,
  PostConditionMode,
  pubKeyfromPrivKey,
  publicKeyToAddress,
  type SingleSigSpendingCondition,
} from "@stacks/transactions";
import { bytesToHex } from "@stacks/common";
import { readFile, writeFile } from "node:fs/promises";
import { getVerificationParams } from "./verification-util.ts";
const deployerKey =
  "db4f3b0e5bd03b05f96f90f35b46918aff8da6bf44a276b3c1cf4aa1f8c879ab01";
const deployerAddress = publicKeyToAddress(
  AddressVersion.TestnetSingleSig,
  pubKeyfromPrivKey(deployerKey)
);
const timestamp = 1753888793828;
const tmSource = await readFile(
  new URL("../contracts/token-manager.clar", import.meta.url),
  "utf-8"
);

const nitSource = await readFile(
  new URL("../contracts/native-interchain-token.clar", import.meta.url),
  "utf-8"
);


const getTx = async (txId: string) => {
  const response = await fetch(
    `https://api.testnet.hiro.so/extended/v1/tx/${txId}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch transaction: ${response.statusText}`);
  }
  return response.json() as any;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForTx = async (txId: string) => {
  while (true) {
    const tx = await getTx(txId);
    if (tx.tx_status === "success") {
      return tx;
    } else if (tx.tx_status === "pending") {
      console.log(`Transaction ${txId} is pending, waiting...`);
      await delay(5000); // Wait for 5 seconds before checking again
    } else {
      throw new Error(`Transaction failed with status: ${tx.tx_status}`);
    }
  }
};

const replaceSources = async () => {
  const verifyOnchain = await readFile(
    new URL(`../contracts/verify-onchain.clar`, import.meta.url),
    "utf-8"
  );

  await writeFile(
    new URL(`../contracts/verify-onchain.clar`, import.meta.url),
    verifyOnchain
      .replace(
        /(\(define-constant nit-contract-code ")(.*)(")/,
        `$1${nitSource.replace(/\n/g, "\\n").replace(/"/g, '\\"')}$3`
      )
      .replace(
        /(\(define-constant token-manager-contract-code ")(.*)(")/,
        `$1${tmSource.replace(/\n/g, "\\n").replace(/"/g, '\\"')}$3`
      )
  );
};
const deployContract = async (
  name: string,
  source: string,
) => {
  const tx = await makeContractDeploy({
    contractName: name,
    senderKey: deployerKey,
    codeBody: source,
    fee: 0x10000,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    network: "testnet",
    clarityVersion: 3,
  });

  const receipt = await broadcastTransaction(tx, "testnet");

  const txData = await waitForTx(receipt.txid);

  const verificationParams = await getVerificationParams(receipt.txid);

  return {
    sig: (tx.auth.spendingCondition as SingleSigSpendingCondition).signature
      .data,
    txIndex: txData.tx_index,
    nonce: txData.nonce,
    feeRate: 0x10000,
    name,
    deployer: deployerAddress,
    txId: receipt.txid,
    blockHeight: txData.block_height,
    blockHeader: bytesToHex(
      (
        verificationParams.data[
          "block-header-without-signer-signatures"
        ] as BufferCV
      ).buffer
    ),
  };
};

const nitParams = await deployContract(
  "native-interchain-token-" + timestamp,
  nitSource,
);

const tmParams = await deployContract(
  "token-manager-" + timestamp,
  tmSource,
);

console.log("NIT Params:", nitParams);
console.log("TM Params:", tmParams);
await replaceSources();
