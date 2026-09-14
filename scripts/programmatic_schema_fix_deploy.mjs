import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { abi, createAccount, createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const OWNER = "0xb1e3ea743df2b006b66751d57337c2bb10e23ecc";
const ACCOUNT_NAME = "beacon-final-deployer";
const CONTRACT_PATH = resolve("contracts/recall_guard.py");
const PROFILE_PATH = resolve("frontend/public/fee-profile.json");
const EVIDENCE_PATH = resolve("deploy/evidence/studio-dev-schema-fix-deploy-broadcast-2026-09-14.json");
const EXPECTED_SOURCE_SHA = "814fd01cd7d1c1d6ab3c2789a54ee76432bdc1e8653b4658b2dfc2348b0a3f3d";

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function keytar() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA_UNAVAILABLE");
  return require(join(appData, "npm", "node_modules", "genlayer", "node_modules", "keytar"));
}

async function loadAccount() {
  const secret = await keytar().getPassword("genlayer-cli", `account:${ACCOUNT_NAME}`);
  if (!secret) throw new Error(`ENCRYPTED_ACCOUNT_LOCKED:${ACCOUNT_NAME}`);
  const account = createAccount(secret);
  if (account.address.toLowerCase() !== OWNER.toLowerCase()) throw new Error("OWNER_ACCOUNT_MISMATCH");
  return account;
}

function preparedConstructor(code, args) {
  const calldataObject = abi.calldata.makeCalldataObject(undefined, args, undefined);
  const constructorCalldata = abi.calldata.encode(calldataObject);
  const serializedTransaction = abi.transactions.serialize([code, constructorCalldata, false]);
  const decodedObject = abi.calldata.decode(constructorCalldata);
  if (!(decodedObject instanceof Map) || !Array.isArray(decodedObject.get("args"))) {
    throw new Error("PREPARED_DEPLOYMENT_DECODE_FAILED");
  }
  const decodedArgs = decodedObject.get("args");
  if (!Array.isArray(decodedArgs[0]) || JSON.stringify(decodedArgs[0]) !== JSON.stringify(["saferproducts.gov"])) {
    throw new Error("CPSC_DOMAIN_ARRAY_ENCODING_FAILED");
  }
  if (!Array.isArray(decodedArgs[1]) || JSON.stringify(decodedArgs[1]) !== JSON.stringify(["amazon.com"])) {
    throw new Error("MARKETPLACE_DOMAIN_ARRAY_ENCODING_FAILED");
  }
  return { constructorCalldata, serializedTransaction, decodedArgs };
}

function feeOptions(profile) {
  const entry = profile.deploy;
  if (!entry) throw new Error("DEPLOY_PROFILE_MISSING");
  return {
    leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
    appealRounds: 1n,
    executionBudgetPerRound: BigInt(entry.executionBudgetPerRound),
    totalMessageFees: BigInt(entry.totalMessageFees),
    rotations: [BigInt(entry.rotationsPerRound), BigInt(entry.rotationsPerRound)],
  };
}

async function main() {
  if (!process.argv.includes("--broadcast-only")) {
    throw new Error("BROADCAST_ONLY_FLAG_REQUIRED");
  }
  const code = new Uint8Array(readFileSync(CONTRACT_PATH));
  const sourceSha = createHash("sha256").update(code).digest("hex");
  if (sourceSha !== EXPECTED_SOURCE_SHA) throw new Error(`SOURCE_SHA_MISMATCH:${sourceSha}`);
  const args = [["saferproducts.gov"], ["amazon.com"]];
  const prepared = preparedConstructor(code, args);
  const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
  const client = createClient({ chain: studioDevnet, endpoint: RPC });
  const account = await loadAccount();
  const fees = feeOptions(profile);
  const estimate = await client.estimateTransactionFees(fees);
  const txId = await client.deployContract({
    account,
    code,
    args,
    fees: { distribution: estimate.distribution, feeValue: estimate.feeValue },
  });

  const evidence = {
    network: "studio-dev",
    rpc: RPC,
    chainId: studioDevnet.id,
    owner: account.address,
    sourceSha256: sourceSha,
    constructorArgs: args,
    decodedConstructorArgs: prepared.decodedArgs,
    decodedConstructorArgTypes: prepared.decodedArgs.map((value) => Array.isArray(value) ? "array" : typeof value),
    feeProfilePath: PROFILE_PATH,
    feeOptions: fees,
    feeDistribution: estimate.distribution,
    feeValue: estimate.feeValue,
    feePolicy: estimate.policy,
    deployTx: txId,
    broadcastCount: 1,
    persistedImmediatelyAfterBroadcast: true,
  };
  mkdirSync(resolve("deploy/evidence"), { recursive: true });
  writeFileSync(EVIDENCE_PATH, json(evidence) + "\n", "utf8");
  console.log(json({ ...evidence, evidencePath: EVIDENCE_PATH }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
