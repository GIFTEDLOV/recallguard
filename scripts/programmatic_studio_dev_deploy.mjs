import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { abi, createAccount, createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const OWNER = "0xb1e3ea743df2b006b66751d57337c2bb10e23ecc";
const ACCOUNT_NAME = "beacon-final-deployer";
const CONTRACT_PATH = resolve("contracts/recall_guard.py");
const PROFILE_PATH = resolve("frontend/public/fee-profile.json");
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function keytar() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA_UNAVAILABLE");
  return require(join(appData, "npm", "node_modules", "genlayer", "node_modules", "keytar"));
}

function loadAccount() {
  return keytar().getPassword("genlayer-cli", `account:${ACCOUNT_NAME}`).then((secret) => {
    if (!secret) throw new Error(`ENCRYPTED_ACCOUNT_LOCKED:${ACCOUNT_NAME}`);
    const account = createAccount(secret);
    if (account.address.toLowerCase() !== OWNER.toLowerCase()) throw new Error("OWNER_ACCOUNT_MISMATCH");
    return account;
  });
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
  for (const argument of decodedArgs) {
    if (typeof argument === "string" && /[\[\]]/.test(argument)) {
      throw new Error("SCALAR_BRACKETED_CONSTRUCTOR_ARGUMENT");
    }
  }
  return { constructorCalldata, serializedTransaction, decodedArgs };
}

function feeOptions(profile) {
  const entry = profile.deploy;
  if (!entry) throw new Error("DEPLOY_PROFILE_MISSING");
  const required = [
    "leaderTimeunitsAllocation",
    "validatorTimeunitsAllocation",
    "executionBudgetPerRound",
    "totalMessageFees",
    "rotationsPerRound",
  ];
  if (required.some((field) => entry[field] === undefined)) throw new Error("DEPLOY_PROFILE_INCOMPLETE");
  // Match the RC CLI's standard profile posture: one appeal round and one
  // rotation budget in each funded round.
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
  const broadcast = process.argv.includes("--broadcast-only");
  const code = new Uint8Array(readFileSync(CONTRACT_PATH));
  const args = [["saferproducts.gov"], ["amazon.com"]];
  const prepared = preparedConstructor(code, args);
  const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
  const client = createClient({ chain: studioDevnet, endpoint: RPC });
  const account = await loadAccount();
  const estimate = await client.estimateTransactionFees(feeOptions(profile));

  console.log(json({
    mode: broadcast ? "broadcast-only" : "prepare-only",
    network: "studio-dev",
    rpc: RPC,
    chainId: studioDevnet.id,
    owner: account.address,
    constructorArgs: args,
    preparedCalldataVerified: true,
    decodedConstructorArgs: prepared.decodedArgs,
    decodedConstructorArgTypes: prepared.decodedArgs.map((value) => Array.isArray(value) ? "array" : typeof value),
    serializedTransactionBytes: (prepared.serializedTransaction.length - 2) / 2,
    feeProfilePath: PROFILE_PATH,
    feeOptions: feeOptions(profile),
    feeDistribution: estimate.distribution,
    feeValue: estimate.feeValue,
    feePolicy: estimate.policy,
  }));

  if (!broadcast) return;

  const txId = await client.deployContract({
    account,
    code,
    args,
    fees: {
      distribution: estimate.distribution,
      feeValue: estimate.feeValue,
    },
  });
  console.log(json({ PROGRAMMATIC_DEPLOY_BROADCAST_RETURNED: txId }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
