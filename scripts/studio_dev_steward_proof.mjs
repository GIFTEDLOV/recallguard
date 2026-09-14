import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { abi, createAccount, createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const CONTRACT = "0xf89F8CB2ddd201185d905107fDbA8bAeeDF066Ca";
const OWNER = "0xb1e3ea743df2b006b66751d57337c2bb10e23ecc";
const OWNER_ACCOUNT = "beacon-final-deployer";
const CHALLENGER = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8";
const CHALLENGER_ACCOUNT = "player2";
const FIXTURE_PATH = resolve("fixtures/v2_live_fixtures.json");
const PROFILE_PATH = resolve("frontend/public/fee-profile.json");
const ASSESSMENT_BROADCAST_EVIDENCE_PATH = resolve("deploy/evidence/studio-dev-assessment-broadcast-2026-09-14.json");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")).fixtures.find((item) => item.id === "A");
const PROFILE = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function keytar() {
  const require = createRequire(import.meta.url);
  const appData = process.env.APPDATA;
  if (!appData) throw new Error("APPDATA_UNAVAILABLE");
  return require(join(appData, "npm", "node_modules", "genlayer", "node_modules", "keytar"));
}

async function loadAccount(name, expectedAddress) {
  const secret = await keytar().getPassword("genlayer-cli", `account:${name}`);
  if (!secret) throw new Error(`ENCRYPTED_ACCOUNT_LOCKED:${name}`);
  const account = createAccount(secret);
  if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(`ACCOUNT_IDENTITY_MISMATCH:${name}:${account.address}`);
  }
  return account;
}

async function accountState(client, address) {
  const [balanceHex, latestHex, pendingHex] = await Promise.all([
    client.request({ method: "eth_getBalance", params: [address, "latest"] }),
    client.request({ method: "eth_getTransactionCount", params: [address, "latest"] }),
    client.request({ method: "eth_getTransactionCount", params: [address, "pending"] }),
  ]);
  return {
    balanceWei: BigInt(balanceHex).toString(),
    latestNonce: Number(BigInt(latestHex)),
    pendingNonce: Number(BigInt(pendingHex)),
    nonceClean: BigInt(latestHex) === BigInt(pendingHex),
  };
}

function statusName(transaction) {
  return String(transaction?.statusName ?? transaction?.status ?? "").toUpperCase();
}

function executionName(transaction) {
  if (transaction?.txExecutionResultName) return String(transaction.txExecutionResultName).toUpperCase();
  if (transaction?.executionResultName) return String(transaction.executionResultName).toUpperCase();
  if (transaction?.txExecutionResult === 1 || transaction?.txExecutionResult === "1") return "FINISHED_WITH_RETURN";
  if (transaction?.txExecutionResult === 2 || transaction?.txExecutionResult === "2") return "FINISHED_WITH_ERROR";
  return "";
}

function feeOptions(method) {
  const entry = PROFILE.methods?.[method];
  if (!entry) throw new Error(`PROFILE_ENTRY_MISSING:${method}`);
  return {
    leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
    appealRounds: 1n,
    executionBudgetPerRound: BigInt(entry.executionBudgetPerRound),
    totalMessageFees: BigInt(entry.totalMessageFees),
    rotations: [BigInt(entry.rotationsPerRound), BigInt(entry.rotationsPerRound)],
  };
}

function prepareCall(functionName, args) {
  const encoded = abi.calldata.encode(abi.calldata.makeCalldataObject(functionName, args, undefined));
  const decoded = abi.calldata.decode(encoded);
  if (!(decoded instanceof Map) || !Array.isArray(decoded.get("args"))) {
    throw new Error("PREPARED_CALL_DECODE_FAILED");
  }
  const decodedArgs = decoded.get("args");
  if (functionName === "request_assessment") {
    const recallIdentifier = args[1];
    if (typeof recallIdentifier !== "string" || recallIdentifier !== "26741" || recallIdentifier.includes("\\") || recallIdentifier.includes('"')) {
      throw new Error("RECALL_IDENTIFIER_NATIVE_STRING_ASSERTION_FAILED");
    }
    if (typeof decodedArgs[1] !== "string" || decodedArgs[1] !== "26741" || decodedArgs[1].includes("\\") || decodedArgs[1].includes('"')) {
      throw new Error("DECODED_RECALL_IDENTIFIER_ASSERTION_FAILED");
    }
  }
  return {
    encodedBytes: (encoded.length - 2) / 2,
    decodedArgs,
    decodedTypes: decodedArgs.map((value) => Array.isArray(value) ? "array" : typeof value),
  };
}

async function readContractState(client) {
  const [contractInfo, listingIds, assessmentIds] = await Promise.all([
    client.readContract({ address: CONTRACT, functionName: "contract_info", args: [], transactionHashVariant: "latest-final" }),
    client.readContract({ address: CONTRACT, functionName: "get_listing_ids", args: [], transactionHashVariant: "latest-final" }),
    client.readContract({ address: CONTRACT, functionName: "get_assessment_ids", args: [], transactionHashVariant: "latest-final" }),
  ]);
  let listing = null;
  let listingAssessments = [];
  const candidateIds = listingIds.includes(FIXTURE.listing_id) ? [FIXTURE.listing_id] : listingIds;
  for (const candidateId of candidateIds) {
    const candidate = await client.readContract({ address: CONTRACT, functionName: "get_listing", args: [candidateId], transactionHashVariant: "latest-final" });
    if (candidate.marketplace_host === FIXTURE.marketplace_host && candidate.external_listing_id === FIXTURE.external_listing_id) {
      listing = candidate;
      listingAssessments = await client.readContract({ address: CONTRACT, functionName: "get_listing_assessments", args: [candidateId], transactionHashVariant: "latest-final" });
      break;
    }
  }
  return { contractInfo, listingIds, assessmentIds, listing, listingId: listing?.id ?? null, listingAssessments };
}

function registerArgs() {
  return [
    FIXTURE.marketplace_host,
    FIXTURE.external_listing_id,
    FIXTURE.product_id,
    FIXTURE.product_name,
    FIXTURE.manufacturer,
    FIXTURE.model,
    FIXTURE.serial_or_lot,
    FIXTURE.listing_url,
  ];
}

async function preflight(client) {
  const state = await readContractState(client);
  if (state.contractInfo?.authorized_recall_domains?.[0] !== "saferproducts.gov" || state.contractInfo?.authorized_marketplace_domains?.[0] !== "amazon.com") {
    throw new Error(`CONTRACT_POLICY_MISMATCH:${json(state.contractInfo)}`);
  }
  return state;
}

async function track(client, txHash, label) {
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED", interval: 5000, retries: 180, fullTransaction: true });
  const status = statusName(receipt);
  const execution = executionName(receipt);
  console.log(json({ [`${label}_TX`]: txHash, [`${label}_STATUS`]: status, [`${label}_EXECUTION`]: execution, receipt }));
  if (status !== "FINALIZED" || execution !== "FINISHED_WITH_RETURN") {
    throw new Error(`${label}_FINALIZED_EXECUTION_FAILED:${json(receipt)}`);
  }
  return receipt;
}

async function main() {
  const mode = process.argv[2] ?? "preflight";
  const client = createClient({ chain: studioDevnet, endpoint: RPC });

  if (mode === "preflight") {
    const state = await preflight(client);
    const owner = await accountState(client, OWNER);
    const challenger = await accountState(client, CHALLENGER);
    console.log(json({
      mode,
      network: "studio-dev",
      rpc: RPC,
      chainId: studioDevnet.id,
      contract: CONTRACT,
      fixture: FIXTURE,
      contractInfo: state.contractInfo,
      listingIds: state.listingIds,
      assessmentIds: state.assessmentIds,
      existingFixtureListing: state.listing,
      existingFixtureAssessments: state.listingAssessments,
      owner,
      challenger,
      challengerDistinct: OWNER.toLowerCase() !== CHALLENGER.toLowerCase(),
    }));
    return;
  }

  if (mode === "broadcast-register") {
    const state = await preflight(client);
    if (state.listing) {
      console.log(json({ REGISTER_NOT_NEEDED: true, listing: state.listing, listingAssessments: state.listingAssessments }));
      return;
    }
    const account = await loadAccount(OWNER_ACCOUNT, OWNER);
    const accountInfo = await accountState(client, OWNER);
    if (!accountInfo.nonceClean) throw new Error(`OWNER_NONCE_NOT_CLEAN:${json(accountInfo)}`);
    const args = registerArgs();
    const prepared = prepareCall("register_listing", args);
    const estimate = await client.estimateTransactionFees(feeOptions("register_listing"));
    if (BigInt(accountInfo.balanceWei) <= BigInt(estimate.feeValue)) throw new Error(`OWNER_BALANCE_INSUFFICIENT:${json({ accountInfo, feeValue: estimate.feeValue })}`);
    console.log(json({ mode, prepared, args, profile: PROFILE.methods.register_listing, distribution: estimate.distribution, feeValue: estimate.feeValue, owner: account.address }));
    const txHash = await client.writeContract({ account, address: CONTRACT, functionName: "register_listing", args, value: 0n, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
    console.log(json({ REGISTER_BROADCAST_RETURNED: txHash }));
    return;
  }

  if (mode === "track-register") {
    const txHash = process.argv.find((arg) => arg.startsWith("--tx="))?.slice(5);
    if (!txHash) throw new Error("REGISTER_TX_REQUIRED");
    await track(client, txHash, "REGISTER");
    const state = await readContractState(client);
    console.log(json({ listing: state.listing, listingIds: state.listingIds, listingAssessments: state.listingAssessments }));
    if (!state.listing || state.listing.owner.toLowerCase() !== OWNER.toLowerCase() || state.listing.state !== "UNASSESSED" || state.listingAssessments.length !== 0) {
      throw new Error(`REGISTERED_LISTING_PROOF_FAILED:${json(state)}`);
    }
    console.log(json({ LISTING_ID: state.listingId, REGISTERED_BY: state.listing.owner, INITIAL_STATE: state.listing.state, INITIAL_ASSESSMENT_COUNT: state.listingAssessments.length }));
    return;
  }

  if (mode === "broadcast-assessment") {
    const state = await preflight(client);
    if (!state.listing || state.listing.owner.toLowerCase() !== OWNER.toLowerCase() || state.listing.state !== "UNASSESSED" || state.listingAssessments.length !== 0) {
      throw new Error(`ASSESSMENT_PRECONDITION_FAILED:${json({ listing: state.listing, listingAssessments: state.listingAssessments })}`);
    }
    const account = await loadAccount(CHALLENGER_ACCOUNT, CHALLENGER);
    const accountInfo = await accountState(client, CHALLENGER);
    if (!accountInfo.nonceClean) throw new Error(`CHALLENGER_NONCE_NOT_CLEAN:${json(accountInfo)}`);
    if (OWNER.toLowerCase() === account.address.toLowerCase()) throw new Error("CHALLENGER_NOT_DISTINCT");
    const recallIdentifier = "26741";
    const args = [state.listing.id, recallIdentifier];
    const prepared = prepareCall("request_assessment", args);
    const estimate = await client.estimateTransactionFees(feeOptions("request_assessment"));
    if (BigInt(accountInfo.balanceWei) <= BigInt(estimate.feeValue)) throw new Error(`CHALLENGER_BALANCE_INSUFFICIENT:${json({ accountInfo, feeValue: estimate.feeValue })}`);
    console.log(json({ mode, prepared, args, recallIdentifierType: typeof recallIdentifier, profile: PROFILE.methods.request_assessment, distribution: estimate.distribution, feeValue: estimate.feeValue, challenger: account.address }));
    const txHash = await client.writeContract({ account, address: CONTRACT, functionName: "request_assessment", args, value: 0n, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
    mkdirSync(resolve("deploy/evidence"), { recursive: true });
    writeFileSync(ASSESSMENT_BROADCAST_EVIDENCE_PATH, json({
      network: "studio-dev",
      rpc: RPC,
      chainId: studioDevnet.id,
      contractAddress: CONTRACT,
      challenger: account.address,
      listingId: state.listing.id,
      recallIdentifier,
      prepared,
      feeProfile: PROFILE.methods.request_assessment,
      distribution: estimate.distribution,
      feeValue: estimate.feeValue,
      assessmentTx: txHash,
      broadcastCount: 1,
      persistedImmediatelyAfterBroadcast: true,
    }) + "\n", "utf8");
    console.log(json({ ASSESSMENT_BROADCAST_RETURNED: txHash }));
    return;
  }

  if (mode === "track-assessment") {
    const txHash = process.argv.find((arg) => arg.startsWith("--tx="))?.slice(5);
    if (!txHash) throw new Error("ASSESSMENT_TX_REQUIRED");
    await track(client, txHash, "ASSESSMENT");
    const state = await readContractState(client);
    const listing = state.listing;
    const listingId = state.listingId;
    if (!listing || !listingId) throw new Error("ASSESSMENT_LISTING_NOT_FOUND");
    const assessmentIds = await client.readContract({ address: CONTRACT, functionName: "get_listing_assessments", args: [listingId], transactionHashVariant: "latest-final" });
    const assessments = await Promise.all(assessmentIds.map((id) => client.readContract({ address: CONTRACT, functionName: "get_assessment", args: [id], transactionHashVariant: "latest-final" })));
    const assessment = assessments[assessments.length - 1];
    const attestation = assessment ? await client.readContract({ address: CONTRACT, functionName: "get_attestation", args: [assessment.id], transactionHashVariant: "latest-final" }) : null;
    console.log(json({ listing, assessmentIds, assessments, attestation }));
    const requestedBy = assessment?.requested_by?.toLowerCase();
    const proof = {
      registeredBy: listing?.owner,
      requestedBy: assessment?.requested_by,
      verdict: assessment?.verdict,
      finalState: listing?.state,
      historyCount: assessmentIds.length,
      historyVerified: assessmentIds.length >= 1 && assessmentIds.includes(assessment?.id),
      attestationVerified: Boolean(attestation && attestation.id === assessment?.id),
      ownerCannotSuppressProven: listing?.owner?.toLowerCase() === OWNER.toLowerCase() && requestedBy === CHALLENGER.toLowerCase() && requestedBy !== OWNER.toLowerCase() && listing?.state === "BLOCKED" && assessmentIds.length >= 1,
    };
    console.log(json(proof));
    if (proof.registeredBy?.toLowerCase() !== OWNER.toLowerCase() || proof.requestedBy?.toLowerCase() !== CHALLENGER.toLowerCase() || proof.verdict !== "AFFECTED" || proof.finalState !== "BLOCKED" || !proof.historyVerified || !proof.attestationVerified) {
      throw new Error(`STEWARD_SEMANTIC_PROOF_FAILED:${json({ proof, listing, assessment, attestation })}`);
    }
    return;
  }

  throw new Error(`UNKNOWN_MODE:${mode}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
