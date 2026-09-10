import { readFileSync } from "fs";
import path from "path";
import {
  DecodedDeployData,
  GenLayerChain,
  GenLayerClient,
  TransactionHash,
  TransactionStatus,
} from "genlayer-js/types";
import { localnet } from "genlayer-js/chains";

const policyPath = path.resolve(process.cwd(), "config/v2_source_policy.json");
const sourcePolicy = JSON.parse(readFileSync(policyPath, "utf-8"));
const productionPolicy = sourcePolicy.production;

function frozenDomains(environmentName: string, domains: string[]): string[] {
  const configured = process.env[environmentName];
  const expected = domains.join(",");
  if (configured && configured.split(",").map((domain) => domain.trim()).filter(Boolean).join(",") !== expected) {
    throw new Error(`${environmentName} does not match frozen V2 source policy in ${policyPath}`);
  }
  return domains;
}

const recallDomains = frozenDomains("RECALLGUARD_RECALL_DOMAINS", productionPolicy.recall_domains);

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/recall_guard.py");
  const contractCode = new Uint8Array(readFileSync(filePath));
  const marketplaceDomains = frozenDomains("RECALLGUARD_MARKETPLACE_DOMAINS", productionPolicy.marketplace_domains);
  const listingEvidenceDomains = frozenDomains("RECALLGUARD_LISTING_EVIDENCE_DOMAINS", productionPolicy.listing_evidence_domains);

  await client.initializeConsensusSmartContract();
  const deployTransaction = await client.deployContract({
    code: contractCode,
    args: [recallDomains, marketplaceDomains, listingEvidenceDomains],
  });
  console.log(`RecallGuard deployment submitted: ${deployTransaction}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: deployTransaction as TransactionHash,
    status: TransactionStatus.FINALIZED,
    retries: 200,
    interval: 5000,
  });

  const executionResult = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  if (executionResult !== "SUCCESS") {
    throw new Error(`Deployment execution failed: ${JSON.stringify(receipt)}`);
  }
  if (receipt.statusName !== "FINALIZED") {
    throw new Error(`Deployment did not finalize: ${JSON.stringify(receipt)}`);
  }

  const deployedContractAddress =
    (client.chain as GenLayerChain).id === localnet.id
      ? receipt.data?.contract_address
      : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;
  if (!deployedContractAddress) {
    throw new Error(`Deployment finalized without a contract address: ${JSON.stringify(receipt)}`);
  }
  console.log(`RecallGuard deployed at address: ${deployedContractAddress}`);
}
