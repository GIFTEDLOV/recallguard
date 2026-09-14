import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, abi, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const RPC = "http://127.0.0.1:4000/api";
const CONTRACT = "0xC6a967E0b0D12c109CD6367F245B422Ae05565A4";
const LISTING_ID = "fc579fdf19698bf917bb7cc5a9e3d29a99fd45911d85306008e34c99cceaa3e0";
const OWNER = "0xb1e3ea743df2b006b66751d57337c2bb10e23ecc";
const ACCOUNT_NAME = "beacon-final-deployer";
const KEYCHAIN_SERVICE = "genlayer-cli";
const KEYCHAIN_ACCOUNT = `account:${ACCOUNT_NAME}`;

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function localKeytar() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA is unavailable; cannot access the existing encrypted account");
  return require(join(appData, "npm", "node_modules", "genlayer", "node_modules", "keytar"));
}

function assertRecallArgument(recallIdentifier) {
  if (typeof recallIdentifier !== "string") throw new Error("RECALL_IDENTIFIER_TYPE_MISMATCH");
  if (recallIdentifier !== "26741") throw new Error("RECALL_IDENTIFIER_VALUE_MISMATCH");
  if (recallIdentifier.length !== 5) throw new Error("RECALL_IDENTIFIER_LENGTH_MISMATCH");
  if (recallIdentifier.includes("\\")) throw new Error("RECALL_IDENTIFIER_CONTAINS_BACKSLASH");
  if (recallIdentifier.includes('"')) throw new Error("RECALL_IDENTIFIER_CONTAINS_QUOTES");
}

function decodedArgs(encoded) {
  const decoded = abi.calldata.decode(encoded);
  if (!(decoded instanceof Map)) throw new Error("SDK_CALldata_DECODE_FAILED");
  const args = decoded.get("args");
  if (!Array.isArray(args)) throw new Error("SDK_CALldata_ARGS_DECODE_FAILED");
  return { decoded, args };
}

function statusName(transaction) {
  if (typeof transaction?.statusName === "string") return transaction.statusName.toUpperCase();
  if (typeof transaction?.status === "string") return transaction.status.toUpperCase();
  return "";
}

function executionName(transaction) {
  if (typeof transaction?.txExecutionResultName === "string") return transaction.txExecutionResultName.toUpperCase();
  if (typeof transaction?.executionResultName === "string") return transaction.executionResultName.toUpperCase();
  return transaction?.txExecutionResult === 1 || transaction?.txExecutionResult === "1" ? "FINISHED_WITH_RETURN" : "";
}

async function main() {
  const recallIdentifier = "26741";
  assertRecallArgument(recallIdentifier);

  const args = [LISTING_ID, recallIdentifier];
  const calldataObject = abi.calldata.makeCalldataObject("request_assessment", args, undefined);
  const encoded = abi.calldata.encode(calldataObject);
  const decoded = decodedArgs(encoded);
  if (decoded.args[1] !== "26741" || typeof decoded.args[1] !== "string") {
    throw new Error(`SDK_DECODED_IDENTIFIER_MISMATCH:${json(decoded.args[1])}`);
  }

  console.log(json({
    WRITE_PATH: "genlayer-js 1.1.8 createClient/writeContract",
    CLI_WRAPPER_USED: false,
    RPC,
    chainId: studionet.id,
    recallIdentifier,
    recallIdentifierType: typeof recallIdentifier,
    recallIdentifierLength: recallIdentifier.length,
    containsQuotes: recallIdentifier.includes('"'),
    containsBackslash: recallIdentifier.includes("\\"),
    sdkDecodedIdentifier: decoded.args[1],
    sdkDecodedIdentifierType: typeof decoded.args[1],
    calldataBytes: encoded.length,
  }));

  const client = createClient({ chain: studionet, endpoint: RPC });
  const listing = await client.readContract({
    address: CONTRACT,
    functionName: "get_listing",
    args: [LISTING_ID],
    transactionHashVariant: "latest-final",
  });
  const beforeAssessments = await client.readContract({
    address: CONTRACT,
    functionName: "get_listing_assessments",
    args: [LISTING_ID],
    transactionHashVariant: "latest-final",
  });
  if (String(listing.owner).toLowerCase() !== OWNER || listing.state !== "UNASSESSED" || beforeAssessments.length !== 0) {
    throw new Error(`LOCAL_PRECONDITION_FAILED:${json({ listing, beforeAssessments })}`);
  }
  console.log(json({ LOCAL_PRECONDITION: "PASS", listing, beforeAssessments }));

  const keytar = localKeytar();
  const accountSecret = await keytar.getPassword(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
  if (!accountSecret) throw new Error(`ENCRYPTED_ACCOUNT_LOCKED:${ACCOUNT_NAME}`);
  const account = createAccount(accountSecret);
  if (account.address.toLowerCase() !== OWNER) throw new Error("LOCAL_ACCOUNT_IDENTITY_MISMATCH");

  const txHash = await client.writeContract({
    account,
    address: CONTRACT,
    functionName: "request_assessment",
    args,
    value: 0n,
  });
  console.log(`LOCAL_ASSESSMENT_TX=${txHash}`);
  mkdirSync("deploy/evidence", { recursive: true });
  writeFileSync("deploy/evidence/local-programmatic-assessment.json", json({
    network: "studionet-compatible-local",
    rpc: RPC,
    chainId: studionet.id,
    contract: CONTRACT,
    listingId: LISTING_ID,
    accountName: ACCOUNT_NAME,
    account: account.address,
    recallIdentifier,
    txHash,
    submittedAt: new Date().toISOString(),
  }) + "\n", "utf8");

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "FINALIZED",
    interval: 5000,
    retries: 120,
    fullTransaction: true,
  });
  const status = statusName(receipt);
  const execution = executionName(receipt);
  console.log(json({ LOCAL_ASSESSMENT_STATUS: status, LOCAL_ASSESSMENT_EXECUTION: execution, receipt }));
  if (status !== "FINALIZED" || execution !== "FINISHED_WITH_RETURN") {
    throw new Error(`LOCAL_ASSESSMENT_FAILED:${json(receipt)}`);
  }

  const listingAfter = await client.readContract({ address: CONTRACT, functionName: "get_listing", args: [LISTING_ID], transactionHashVariant: "latest-final" });
  const assessmentIds = await client.readContract({ address: CONTRACT, functionName: "get_listing_assessments", args: [LISTING_ID], transactionHashVariant: "latest-final" });
  const assessments = await Promise.all(assessmentIds.map((id) => client.readContract({ address: CONTRACT, functionName: "get_assessment", args: [id], transactionHashVariant: "latest-final" })));
  const attestation = assessmentIds.length ? await client.readContract({ address: CONTRACT, functionName: "get_attestation", args: [assessmentIds[assessmentIds.length - 1]], transactionHashVariant: "latest-final" }) : null;
  console.log(json({ listingAfter, assessmentIds, assessments, attestation }));
  const assessment = assessments[assessments.length - 1];
  if (assessment?.verdict !== "AFFECTED" || listingAfter.state !== "BLOCKED" || assessmentIds.length < 1 || !attestation) {
    throw new Error(`LOCAL_SEMANTIC_RESULT_MISMATCH:${json({ listingAfter, assessmentIds, assessments, attestation })}`);
  }
  console.log(json({ LOCAL_VERDICT: assessment.verdict, LOCAL_FINAL_STATE: listingAfter.state, LOCAL_HISTORY_COUNT: assessmentIds.length, LOCAL_ATTESTATION_VERIFIED: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
