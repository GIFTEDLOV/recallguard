import { createHash } from "node:crypto";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const TX = "0x8dd3dd1eb183f565834ca7c403e1ee93b65aa4369d63228e2066580959d51c83";
const EXPECTED_SOURCE_SHA = "5ccac7504d6f892e28244e842aa4a2545b69e2ee4d5008b68d90445cabdd888f";
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

function sha256(text) {
  return createHash("sha256").update(new TextEncoder().encode(text)).digest("hex");
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
  const client = createClient({ chain: studioDevnet, endpoint: RPC });
  const receipt = await client.waitForFinalization({
    hash: TX,
    interval: 5000,
    retries: 240,
    fullTransaction: true,
  });

  const status = receipt.statusName ?? receipt.status;
  const execution = receipt.txExecutionResultName ?? receipt.txExecutionResult;
  const contractAddress = findContractAddress(receipt);
  const report = {
    network: "studio-dev",
    rpc: RPC,
    chainId: studioDevnet.id,
    tx: TX,
    status,
    execution,
    receipt,
  };

  if (execution !== "FINISHED_WITH_RETURN") {
    console.log(json(report));
    process.exitCode = 2;
    return;
  }

  if (!contractAddress) {
    console.log(json({ ...report, error: "CONTRACT_ADDRESS_NOT_FOUND" }));
    process.exitCode = 3;
    return;
  }

  const schema = await client.getContractSchema(contractAddress);
  const schemaText = JSON.stringify(schema);
  const contractInfo = await client.readContract({
    address: contractAddress,
    functionName: "contract_info",
    args: [],
  });
  const source = await client.getContractCode(contractAddress);
  const sourceSha = sha256(source);

  console.log(json({
    ...report,
    contractAddress,
    contractInfo,
    requiredMethodsVerified: REQUIRED_METHODS.every((method) => schemaText.includes(`"${method}"`)),
    requiredMethods: REQUIRED_METHODS,
    schema,
    deployedSourceSha256: sourceSha,
    deployedSourceShaMatch: sourceSha.toLowerCase() === EXPECTED_SOURCE_SHA,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
