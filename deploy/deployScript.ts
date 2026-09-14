import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import type { GenLayerClient } from "genlayer-js/types";
import { TransactionHashVariant, type GenLayerTransaction, type TransactionHash } from "genlayer-js/types";

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
  if (typeof receipt.statusName === "string") return receipt.statusName.toUpperCase();
  if (typeof receipt.status === "string") return receipt.status.toUpperCase();
  if (receipt.status === 7) return "FINALIZED";
  return "";
}

function executionSucceeded(receipt: Record<string, any>): boolean {
  if (statusName(receipt) !== "FINALIZED") return false;
  if (typeof receipt.txExecutionResultName === "string") return receipt.txExecutionResultName.toUpperCase() === "FINISHED_WITH_RETURN";
  return receipt.txExecutionResult === 1 || receipt.txExecutionResult === "1";
}

export default async function main(client: GenLayerClient<any>) {
  const contractCode = new Uint8Array(readFileSync(path.resolve(process.cwd(), "contracts/recall_guard.py")));
  const recallDomains = frozenDomains("RECALLGUARD_RECALL_DOMAINS", productionPolicy.recall_domains);
  const marketplaceDomains = frozenDomains("RECALLGUARD_MARKETPLACE_DOMAINS", productionPolicy.marketplace_domains);

  const deployTransaction = await client.deployContract({
    code: contractCode,
    args: [recallDomains, marketplaceDomains],
  });
  console.log(`RecallGuard V2 deployment protocol transaction ID: ${deployTransaction}`);

  const receipt = await client.waitForTransactionReceipt({ hash: deployTransaction as TransactionHash, status: "FINALIZED", retries: 200, interval: 5000 });
  const normalizedReceipt = receipt as GenLayerTransaction;
  if (!executionSucceeded(normalizedReceipt as Record<string, any>)) {
    throw new Error(`Deployment did not finish successfully: ${JSON.stringify(normalizedReceipt)}`);
  }
  const receiptData = normalizedReceipt as unknown as Record<string, any>;
  const deployedContractAddress = receiptData.txDataDecoded?.contractAddress || receiptData.data?.contract_address;
  if (!deployedContractAddress) throw new Error(`Deployment finalized without a contract address: ${JSON.stringify(normalizedReceipt)}`);
  const info = await client.readContract({ address: deployedContractAddress, functionName: "contract_info", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL }) as Record<string, any>;
  if (info?.version !== "v2" || info?.source_policy_version !== sourcePolicy.policy_version) throw new Error("Deployment readback does not match frozen V2 policy");
  const deployedSource = await client.getContractCode(deployedContractAddress);
  const localSourceSha = createHash("sha256").update(contractCode).digest("hex");
  const deployedSourceSha = createHash("sha256").update(new TextEncoder().encode(deployedSource)).digest("hex");
  if (deployedSourceSha !== localSourceSha) throw new Error(`Deployed source SHA mismatch: ${deployedSourceSha} != ${localSourceSha}`);
  console.log(`RecallGuard V2 deployed at address: ${deployedContractAddress}`);
}
