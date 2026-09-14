import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const CHAIN_ID = 61997;
const CONTRACT = "0x6E2EAfF16124c513022Ad85751fD4dfF8d7e5580";
const LISTING_ID = "fc579fdf19698bf917bb7cc5a9e3d29a99fd45911d85306008e34c99cceaa3e0";
const ASSESSMENT_TX = "0xa1d7ea20dd909cac43776a8a09b5186e8f6a7d94bb1023f050af8b9d7ab4d8ce";

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function statusName(receipt) {
  return String(receipt?.statusName ?? receipt?.status ?? "").toUpperCase();
}

function executionName(receipt) {
  return String(receipt?.txExecutionResultName ?? receipt?.txExecutionResult ?? "").toUpperCase();
}

async function main() {
  const client = createClient({ chain: studioDevnet, endpoint: RPC });
  if (studioDevnet.id !== CHAIN_ID) throw new Error(`CHAIN_ID_MISMATCH:${studioDevnet.id}`);
  const [listing, assessmentIds, contractInfo, tx] = await Promise.all([
    client.readContract({ address: CONTRACT, functionName: "get_listing", args: [LISTING_ID], transactionHashVariant: "latest-final" }),
    client.readContract({ address: CONTRACT, functionName: "get_listing_assessments", args: [LISTING_ID], transactionHashVariant: "latest-final" }),
    client.readContract({ address: CONTRACT, functionName: "contract_info", args: [], transactionHashVariant: "latest-final" }),
    client.getTransaction({ hash: ASSESSMENT_TX }),
  ]);
  const assessments = await Promise.all(assessmentIds.map((id) => client.readContract({ address: CONTRACT, functionName: "get_assessment", args: [id], transactionHashVariant: "latest-final" })));
  const assessment = assessments.find((item) => item.recall_identifier === "26741" && item.requested_by.toLowerCase() === "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8".toLowerCase());
  const attestation = assessment ? await client.readContract({ address: CONTRACT, functionName: "get_attestation", args: [assessment.id], transactionHashVariant: "latest-final" }) : null;
  const txStatus = statusName(tx);
  const txExecution = executionName(tx);
  const calldata = tx?.data?.calldata?.readable ?? tx?.data?.calldata?.raw ?? "";
  const report = {
    rpc: RPC,
    chainId: CHAIN_ID,
    contractAddress: CONTRACT,
    listingId: LISTING_ID,
    listingState: listing.state,
    registeredBy: listing.owner,
    historyIds: assessmentIds,
    historyRead: assessmentIds.length >= 1,
    assessment,
    attestation,
    attestationRead: Boolean(attestation && attestation.id === assessment?.id),
    assessmentTx: ASSESSMENT_TX,
    assessmentTxStatus: txStatus,
    assessmentTxExecution: txExecution,
    assessmentTxMatchesContract: String(tx?.to_address ?? "").toLowerCase() === CONTRACT.toLowerCase(),
    assessmentTxCalldataMatches: String(calldata).includes(LISTING_ID) && String(calldata).includes("26741"),
    contractInfo,
  };
  console.log(json(report));
  if (listing.state !== "BLOCKED" || !report.historyRead || !report.attestationRead || !assessment || txStatus !== "FINALIZED" || txExecution !== "FINISHED_WITH_RETURN" || !report.assessmentTxMatchesContract || !report.assessmentTxCalldataMatches) {
    throw new Error(`FRONTEND_LIVE_SMOKE_FAILED:${json(report)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
