import {
  AddressVersion,
  broadcastTransaction,
  makeContractDeploy,
  PostConditionMode,
  pubKeyfromPrivKey,
  publicKeyToAddress,
  SingleSigSpendingCondition,
} from "@stacks/transactions";

import { readFile } from "node:fs/promises";
const deployerKey =
  "da18192791ed5c1d36197ba29d64dcf57964744a50f858525de65562389c160501";
const deployerAddress = publicKeyToAddress(
  AddressVersion.TestnetSingleSig,
  pubKeyfromPrivKey(deployerKey)
);
const nextNonce = 17;
const timestamp = 1753881334775;
const tmSource = (
  await readFile(
    new URL("../contracts/token-manager.clar", import.meta.url),
    "utf-8"
  )
).replaceAll("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", deployerAddress);

const nitSource = (
  await readFile(
    new URL("../contracts/native-interchain-token.clar", import.meta.url),
    "utf-8"
  )
).replaceAll("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", deployerAddress);

export const nitMockParams = {
  nonce: nextNonce,
  feeRate: 0x10000,
  sig: "01b21e6c5a630e28d041a8c60e3e9841769252fc3608b1dd72e0a4775fb31f6b9d28ee416ef2e93477a7be4748e799aaeff5bdcd8d0c009974fe4ecc47b759426f",
  name: "nit",
  deployer: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
  txIndex: 0,
  txId: "bb4ca8f9fbe3e64c89d9ed2cbf3aa1486bdcf4e284df4455ce268fe385d94dac",
  blockHeight: 126,
  blockHeader:
    "00000000000000007e000000000025d780eddb7c5ff1d52564dbac67fa941e5e53cd1889b02f4ef87ea3b467fa20941514b04db78ea65157f13b0d5b9dd55238412543f4a319dc19ead1f161298a1743c8b8115bda851b78cc7d58cafda84b430083c0fe913bdd40aa2bcb1c65662272395116bd32b8ceb3777aa72a605de91dbe390606cc0000000067b7481800c6a99e740e88cc11bec1bb32ebb7523cea3f46555ef41cd290e5ad328c93f15411985cca380187190ad49d624d4bf62023fb49ffb72dd72f80b8c1eab65fe039001000000002ffff",
};

export const tmMockParams = {
  nonce: nextNonce + 1,
  feeRate: 0x10000,
  sig: "00e8a976c2d5967bb14043238aebf612fd8bc981f390a3112a619866f9c19b3d806b056415a55cb18e54c9323ef40932fc1bb462be38d9be73dccd1ec1f2c7f199",
  name: "token-man",
  deployer: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
  txIndex: 0,
  txId: "3fe8b4d4e873d10d3a6676111808af5b63297dd8799e02d824f4d83f15e6495e",
  blockHeight: 130,
  blockHeader:
    "000000000000000082000000000026c1e0071f791c4510ffc6f0aac00d46591fb134f8598fe882465881656dd6f8db6607185166ddaaed969455bf745bd2944694a808b4cc40000463c06ddaca1fbda4af2d49a4c425efea964a57de4431a92f91dedf59e93884bca3dbf547af74d97f519bf6623fec715ee6655c1403495f5991d409a4440000000067b7482701b44b5388d440302ade9a4bea06656ec1c7a849cf804ed1e136cf2bf76cf030723e1c2e80f6169221d3d8ee59a133c78e939a5ff9cca86c670c914c8b950227bb001000000002ffff",
};

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
const deployContract = async (
  name: string,
  source: string,
  nonce: number,
  feeRate: number
) => {
  const tx = await makeContractDeploy({
    contractName: name,
    senderKey: deployerKey,
    codeBody: source,
    nonce,
    fee: feeRate,
    anchorMode: "any",
    postConditionMode: PostConditionMode.Allow,
    network: "testnet",
    clarityVersion: 3,
  });

  const receipt = await broadcastTransaction(tx, "testnet");

  const txData = await waitForTx(receipt.txid);

  return {
    tx,
    signature: (tx.auth.spendingCondition as SingleSigSpendingCondition)
      .signature.data,
    receipt,
    txIndex: txData.tx_index,
  };
};

await deployContract(
  "native-interchain-token-" + timestamp,
  nitSource,
  nitMockParams.nonce,
  nitMockParams.feeRate
);
