import { existsSync, readFileSync } from "fs";
import path from "path";
import type { GenLayerClient } from "genlayer-js/types";

const policyPath = path.resolve(process.cwd(), "config/v2_source_policy.json");
const sourcePolicy = JSON.parse(readFileSync(policyPath, "utf-8"));
const productionPolicy = sourcePolicy.production as { recall_domains: string[]; marketplace_domains: string[] };

function frozenDomains(environmentName: string, domains: string[]): string[] {
  const configured = process.env[environmentName];
  const expected = domains.join(",");
  if (configured && configured.split(",").map((domain) => domain.trim()).filter(Boolean).join(",") !== expected) {
    throw new Error(`${environmentName} does not match frozen V2 source policy in ${policyPath}`);
  }
  return domains;
}

function statusName(receipt: Record<string, any>): string {
  return typeof receipt.statusName === "string" ? receipt.statusName.toUpperCase() : typeof receipt.status === "string" ? receipt.status.toUpperCase() : "";
}

function executionName(receipt: Record<string, any>): string {
  return String(receipt.txExecutionResultName || receipt.executionResultName || "").toUpperCase();
}

function profileEntry(profile: any, key: "deploy" | "register_listing" | "request_assessment"): Record<string, any> {
  const entry = key === "deploy" ? profile?.deploy : profile?.methods?.[key];
  if (!entry || profile?.status === "NOT_GENERATED") throw new Error("FEE_PROFILE_REQUIRED: measured fee-profile.json is missing or not generated");
  return entry;
}

async function estimateFees(client: any, profile: any, key: "deploy" | "register_listing" | "request_assessment"): Promise<Record<string, any>> {
  if (typeof client.estimateTransactionFees !== "function") throw new Error("TOOLCHAIN:GENLAYER_JS_V2_FEE_ESTIMATOR_REQUIRED");
  const entry = profileEntry(profile, key);
  const appealRounds = 1;
  const rotations = Number(entry.rotationsPerRound || 0);
  const estimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
    executionBudgetPerRound: BigInt(entry.executionBudgetPerRound),
    totalMessageFees: BigInt(entry.totalMessageFees || "0"),
    appealRounds,
    rotations: Array.from({ length: appealRounds + 1 }, () => rotations),
  });
  if (!estimate?.distribution || estimate.feeValue === undefined) throw new Error("FEE_PROFILE_REQUIRED: SDK returned no fee quote");
  return { distribution: estimate.distribution, feeValue: estimate.feeValue };
}

export default async function main(client: GenLayerClient<any>) {
  const feeProfilePath = path.resolve(process.cwd(), "fee-profile.json");
  if (!existsSync(feeProfilePath)) throw new Error(`FEE_PROFILE_REQUIRED: ${feeProfilePath}`);
  const feeProfile = JSON.parse(readFileSync(feeProfilePath, "utf-8"));
  const contractCode = new Uint8Array(readFileSync(path.resolve(process.cwd(), "contracts/recall_guard.py")));
  const recallDomains = frozenDomains("RECALLGUARD_RECALL_DOMAINS", productionPolicy.recall_domains);
  const marketplaceDomains = frozenDomains("RECALLGUARD_MARKETPLACE_DOMAINS", productionPolicy.marketplace_domains);
  const fees = await estimateFees(client, feeProfile, "deploy");

  // The current official deployment path resolves consensus contracts from the
  // selected chain definition. Do not call the deprecated initializer.
  const deployTransaction = await (client as any).deployContract({
    code: contractCode,
    args: [recallDomains, marketplaceDomains],
    fees,
  });
  console.log(`RecallGuard V2 deployment submitted: ${deployTransaction}`);

  const receipt = typeof (client as any).waitForFinalization === "function"
    ? await (client as any).waitForFinalization({ hash: deployTransaction })
    : await (client as any).waitForTransactionReceipt({ hash: deployTransaction, status: "FINALIZED", retries: 200, interval: 5000 });
  const normalizedReceipt = receipt as Record<string, any>;
  if (statusName(normalizedReceipt) !== "FINALIZED" || executionName(normalizedReceipt) !== "FINISHED_WITH_RETURN") {
    throw new Error(`Deployment did not finish successfully: ${JSON.stringify(normalizedReceipt)}`);
  }
  const deployedContractAddress = normalizedReceipt.txDataDecoded?.contractAddress || normalizedReceipt.data?.contract_address;
  if (!deployedContractAddress) throw new Error(`Deployment finalized without a contract address: ${JSON.stringify(normalizedReceipt)}`);
  const info = await (client as any).readContract({ address: deployedContractAddress, functionName: "contract_info", args: [] });
  if (info?.version !== "v2" || info?.source_policy_version !== sourcePolicy.policy_version) throw new Error("Deployment readback does not match frozen V2 policy");
  console.log(`RecallGuard V2 deployed at address: ${deployedContractAddress}`);
}
