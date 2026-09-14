import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const EXPECTED_SOURCE_SHA = "814fd01cd7d1c1d6ab3c2789a54ee76432bdc1e8653b4658b2dfc2348b0a3f3d";
const EVIDENCE_PATH = resolve("deploy/evidence/studio-dev-schema-fix-deploy-track-2026-09-14.json");
const REQUIRED_METHODS = [
  "register_listing",
  "request_assessment",
  "get_listing",
  "get_assessment",
  "get_listing_ids",
  "get_assessment_ids",
  "get_listing_assessments",
  "get_attestation",
  "contract_info",
];

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function sha256(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return createHash("sha256").update(bytes).digest("hex");
}

function findContractAddress(receipt) {
  return receipt?.txDataDecoded?.contractAddress
    ?? receipt?.txDataDecoded?.contract_address
    ?? receipt?.data?.contractAddress
    ?? receipt?.data?.contract_address
    ?? receipt?.contractAddress
    ?? null;
}

async function main() {
  const tx = process.argv.find((arg) => arg.startsWith("--tx="))?.slice(5);
  if (!tx) throw new Error("DEPLOY_TX_REQUIRED");
  const client = createClient({ chain: studioDevnet, endpoint: RPC });
  const receipt = await client.waitForFinalization({ hash: tx, interval: 5000, retries: 240, fullTransaction: true });
  const status = String(receipt.statusName ?? receipt.status ?? "").toUpperCase();
  const execution = String(receipt.txExecutionResultName ?? receipt.txExecutionResult ?? "").toUpperCase();
  const contractAddress = findContractAddress(receipt);
  if (status !== "FINALIZED" || execution !== "FINISHED_WITH_RETURN") {
    throw new Error(`DEPLOY_TERMINAL_STATE_FAILED:${json({ tx, status, execution, receipt })}`);
  }
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS_NOT_FOUND");
  if (contractAddress.toLowerCase() === "0xf89f8cb2ddd201185d905107f dba8baeedf066ca".replace(/\s/g, "")) {
    throw new Error("OLD_CONTRACT_ADDRESS_REUSED");
  }
  const schema = await client.getContractSchema(contractAddress);
  const schemaText = JSON.stringify(schema);
  const contractInfo = await client.readContract({ address: contractAddress, functionName: "contract_info", args: [] });
  const source = await client.getContractCode(contractAddress);
  const sourceSha = sha256(source);
  const report = {
    network: "studio-dev",
    rpc: RPC,
    chainId: studioDevnet.id,
    deployTx: tx,
    status,
    execution,
    receipt,
    contractAddress,
    contractInfo,
    requiredMethods: REQUIRED_METHODS,
    requiredMethodsVerified: REQUIRED_METHODS.every((method) => schemaText.includes(`"${method}"`)),
    schema,
    deployedSourceSha256: sourceSha,
    deployedSourceShaMatch: sourceSha.toLowerCase() === EXPECTED_SOURCE_SHA,
  };
  if (!report.requiredMethodsVerified || !report.deployedSourceShaMatch) {
    throw new Error(`DEPLOYMENT_QUALIFICATION_FAILED:${json(report)}`);
  }
  mkdirSync(resolve("deploy/evidence"), { recursive: true });
  writeFileSync(EVIDENCE_PATH, json(report) + "\n", "utf8");
  console.log(json({ ...report, evidencePath: EVIDENCE_PATH }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
