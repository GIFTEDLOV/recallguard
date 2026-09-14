import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { abi, createAccount, createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const RPC = "https://studio-dev.genlayer.com/api";
const OLD_CONTRACT = "0xf89F8CB2ddd201185d905107fDbA8bAeeDF066Ca";
const OWNER = "0xb1e3ea743df2b006b66751d57337c2bb10e23ecc";
const OWNER_ACCOUNT = "beacon-final-deployer";
const CHALLENGER = "0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8";
const CHALLENGER_ACCOUNT = "player2";
const FIXTURE_PATH = resolve("fixtures/v2_live_fixtures.json");
const PROFILE_PATH = resolve("frontend/public/fee-profile.json");
const CPSC_FIXTURE_PATH = resolve("fixtures/cpsc_26741_response_shape.json");
const REGISTER_BROADCAST_PATH = resolve("deploy/evidence/studio-dev-schema-fix-register-broadcast-2026-09-14.json");
const ASSESSMENT_BROADCAST_PATH = resolve("deploy/evidence/studio-dev-schema-fix-assessment-broadcast-2026-09-14.json");
const REGISTER_TRACK_PATH = resolve("deploy/evidence/studio-dev-schema-fix-register-track-2026-09-14.json");
const ASSESSMENT_TRACK_PATH = resolve("deploy/evidence/studio-dev-schema-fix-assessment-track-2026-09-14.json");
const FINAL_EVIDENCE_PATH = resolve("deploy/evidence/studio-dev-steward-proof-schema-fix-2026-09-14.json");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")).fixtures.find((item) => item.id === "A");
const CPSC_RECORD = JSON.parse(readFileSync(CPSC_FIXTURE_PATH, "utf8"))[0];
const PROFILE = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));

function json(value) {
  return JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry, 2);
}

function arg(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function contractArg() {
  const value = arg("contract");
  if (!value) throw new Error("NEW_CONTRACT_REQUIRED");
  if (value.toLowerCase() === OLD_CONTRACT.toLowerCase()) throw new Error("OLD_CONTRACT_ADDRESS_REUSED");
  return value;
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
  const expectedBudget = method === "register_listing" ? "157268500000000" : "158846500000000";
  if (String(entry.executionBudgetPerRound) !== expectedBudget) throw new Error(`FEE_BUDGET_MISMATCH:${method}`);
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
  if (!(decoded instanceof Map) || !Array.isArray(decoded.get("args"))) throw new Error("PREPARED_CALL_DECODE_FAILED");
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

async function readState(client, contract) {
  const [contractInfo, listingIds, assessmentIds] = await Promise.all([
    client.readContract({ address: contract, functionName: "contract_info", args: [], transactionHashVariant: "latest-final" }),
    client.readContract({ address: contract, functionName: "get_listing_ids", args: [], transactionHashVariant: "latest-final" }),
    client.readContract({ address: contract, functionName: "get_assessment_ids", args: [], transactionHashVariant: "latest-final" }),
  ]);
  let listing = null;
  let listingAssessments = [];
  for (const candidateId of listingIds) {
    const candidate = await client.readContract({ address: contract, functionName: "get_listing", args: [candidateId], transactionHashVariant: "latest-final" });
    if (candidate.marketplace_host === FIXTURE.marketplace_host && candidate.external_listing_id === FIXTURE.external_listing_id) {
      listing = candidate;
      listingAssessments = await client.readContract({ address: contract, functionName: "get_listing_assessments", args: [candidate.id], transactionHashVariant: "latest-final" });
      break;
    }
  }
  return { contractInfo, listingIds, assessmentIds, listing, listingId: listing?.id ?? null, listingAssessments };
}

async function preflight(client, contract) {
  const state = await readState(client, contract);
  if (state.contractInfo?.authorized_recall_domains?.[0] !== "saferproducts.gov" || state.contractInfo?.authorized_marketplace_domains?.[0] !== "amazon.com") {
    throw new Error(`CONTRACT_POLICY_MISMATCH:${json(state.contractInfo)}`);
  }
  return state;
}

async function track(client, txHash, label) {
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, status: "FINALIZED", interval: 5000, retries: 180, fullTransaction: true });
  const status = statusName(receipt);
  const execution = executionName(receipt);
  if (status !== "FINALIZED" || execution !== "FINISHED_WITH_RETURN") throw new Error(`${label}_FINALIZED_EXECUTION_FAILED:${json(receipt)}`);
  return { tx: txHash, status, execution, receipt };
}

function persist(path, value) {
  mkdirSync(resolve("deploy/evidence"), { recursive: true });
  writeFileSync(path, json(value) + "\n", "utf8");
}

async function main() {
  const mode = process.argv[2];
  const contract = contractArg();
  const client = createClient({ chain: studioDevnet, endpoint: RPC });

  if (mode === "preflight") {
    const state = await preflight(client, contract);
    const owner = await accountState(client, OWNER);
    const challenger = await accountState(client, CHALLENGER);
    console.log(json({ mode, network: "studio-dev", rpc: RPC, chainId: studioDevnet.id, contract, fixture: FIXTURE, contractInfo: state.contractInfo, listingIds: state.listingIds, assessmentIds: state.assessmentIds, existingFixtureListing: state.listing, existingFixtureAssessments: state.listingAssessments, owner, challenger, challengerDistinct: OWNER.toLowerCase() !== CHALLENGER.toLowerCase() }));
    return;
  }

  if (mode === "broadcast-register") {
    const state = await preflight(client, contract);
    if (state.listing) throw new Error(`REGISTER_ALREADY_EXISTS:${json(state.listing)}`);
    const account = await loadAccount(OWNER_ACCOUNT, OWNER);
    const accountInfo = await accountState(client, OWNER);
    if (!accountInfo.nonceClean) throw new Error(`OWNER_NONCE_NOT_CLEAN:${json(accountInfo)}`);
    const args = registerArgs();
    const prepared = prepareCall("register_listing", args);
    const estimate = await client.estimateTransactionFees(feeOptions("register_listing"));
    if (BigInt(accountInfo.balanceWei) <= BigInt(estimate.feeValue)) throw new Error(`OWNER_BALANCE_INSUFFICIENT:${json({ accountInfo, feeValue: estimate.feeValue })}`);
    const txHash = await client.writeContract({ account, address: contract, functionName: "register_listing", args, value: 0n, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
    persist(REGISTER_BROADCAST_PATH, { network: "studio-dev", rpc: RPC, chainId: studioDevnet.id, contractAddress: contract, owner: account.address, args, prepared, feeProfile: PROFILE.methods.register_listing, distribution: estimate.distribution, feeValue: estimate.feeValue, registerTx: txHash, broadcastCount: 1, persistedImmediatelyAfterBroadcast: true });
    console.log(json({ REGISTER_BROADCAST_RETURNED: txHash, evidencePath: REGISTER_BROADCAST_PATH }));
    return;
  }

  if (mode === "track-register") {
    const txHash = arg("tx");
    if (!txHash) throw new Error("REGISTER_TX_REQUIRED");
    const terminal = await track(client, txHash, "REGISTER");
    const state = await readState(client, contract);
    if (!state.listing || state.listing.owner.toLowerCase() !== OWNER.toLowerCase() || state.listing.state !== "UNASSESSED" || state.listingAssessments.length !== 0) throw new Error(`REGISTERED_LISTING_PROOF_FAILED:${json(state)}`);
    const report = { ...terminal, contractAddress: contract, listing: state.listing, listingId: state.listingId, registeredBy: state.listing.owner, initialState: state.listing.state, initialAssessmentCount: state.listingAssessments.length };
    persist(REGISTER_TRACK_PATH, report);
    console.log(json({ ...report, evidencePath: REGISTER_TRACK_PATH }));
    return;
  }

  if (mode === "broadcast-assessment") {
    const state = await preflight(client, contract);
    if (!state.listing || state.listing.owner.toLowerCase() !== OWNER.toLowerCase() || state.listing.state !== "UNASSESSED" || state.listingAssessments.length !== 0) throw new Error(`ASSESSMENT_PRECONDITION_FAILED:${json({ listing: state.listing, listingAssessments: state.listingAssessments })}`);
    const account = await loadAccount(CHALLENGER_ACCOUNT, CHALLENGER);
    const accountInfo = await accountState(client, CHALLENGER);
    if (!accountInfo.nonceClean) throw new Error(`CHALLENGER_NONCE_NOT_CLEAN:${json(accountInfo)}`);
    if (OWNER.toLowerCase() === account.address.toLowerCase()) throw new Error("CHALLENGER_NOT_DISTINCT");
    const recallIdentifier = "26741";
    const args = [state.listing.id, recallIdentifier];
    const prepared = prepareCall("request_assessment", args);
    const estimate = await client.estimateTransactionFees(feeOptions("request_assessment"));
    if (BigInt(accountInfo.balanceWei) <= BigInt(estimate.feeValue)) throw new Error(`CHALLENGER_BALANCE_INSUFFICIENT:${json({ accountInfo, feeValue: estimate.feeValue })}`);
    const txHash = await client.writeContract({ account, address: contract, functionName: "request_assessment", args, value: 0n, fees: { distribution: estimate.distribution, feeValue: estimate.feeValue } });
    persist(ASSESSMENT_BROADCAST_PATH, { network: "studio-dev", rpc: RPC, chainId: studioDevnet.id, contractAddress: contract, challenger: account.address, listingId: state.listing.id, recallIdentifier, prepared, feeProfile: PROFILE.methods.request_assessment, distribution: estimate.distribution, feeValue: estimate.feeValue, assessmentTx: txHash, broadcastCount: 1, persistedImmediatelyAfterBroadcast: true });
    console.log(json({ ASSESSMENT_BROADCAST_RETURNED: txHash, evidencePath: ASSESSMENT_BROADCAST_PATH }));
    return;
  }

  if (mode === "track-assessment") {
    const txHash = arg("tx");
    const deployTx = arg("deploy-tx");
    const registerTx = arg("register-tx");
    const newSourceSha = arg("new-source-sha");
    if (!txHash || !deployTx || !registerTx || !newSourceSha) throw new Error("ASSESSMENT_TRACK_ARGUMENTS_REQUIRED");
    const terminal = await track(client, txHash, "ASSESSMENT");
    const state = await readState(client, contract);
    if (!state.listing || !state.listingId) throw new Error("ASSESSMENT_LISTING_NOT_FOUND");
    const assessmentIds = await client.readContract({ address: contract, functionName: "get_listing_assessments", args: [state.listingId], transactionHashVariant: "latest-final" });
    const assessments = await Promise.all(assessmentIds.map((id) => client.readContract({ address: contract, functionName: "get_assessment", args: [id], transactionHashVariant: "latest-final" })));
    const assessment = assessments[assessments.length - 1];
    const attestation = assessment ? await client.readContract({ address: contract, functionName: "get_attestation", args: [assessment.id], transactionHashVariant: "latest-final" }) : null;
    const requestedBy = assessment?.requested_by?.toLowerCase();
    const proof = {
      registeredBy: state.listing.owner,
      requestedBy: assessment?.requested_by,
      verdict: assessment?.verdict,
      finalState: state.listing.state,
      historyCount: assessmentIds.length,
      historyVerified: assessmentIds.length >= 1 && assessmentIds.includes(assessment?.id),
      attestationVerified: Boolean(attestation && attestation.id === assessment?.id),
      ownerCannotSuppressProven: state.listing.owner.toLowerCase() === OWNER.toLowerCase() && requestedBy === CHALLENGER.toLowerCase() && requestedBy !== OWNER.toLowerCase() && state.listing.state === "BLOCKED" && assessmentIds.length >= 1,
    };
    if (proof.registeredBy?.toLowerCase() !== OWNER.toLowerCase() || proof.requestedBy?.toLowerCase() !== CHALLENGER.toLowerCase() || proof.verdict !== "AFFECTED" || proof.finalState !== "BLOCKED" || !proof.historyVerified || !proof.attestationVerified) throw new Error(`STEWARD_SEMANTIC_PROOF_FAILED:${json({ proof, state, assessment, attestation })}`);
    const evidence = {
      network: "studio-dev",
      rpc: RPC,
      chainId: studioDevnet.id,
      oldFailedContractAddress: OLD_CONTRACT,
      oldRegisterTx: "0x7eb621fc21070e5ae7c13afa6cfed777644f5f4ba2dc47be6bb93bb45d86388d",
      oldFailedAssessmentTx: "0x2410f57158d07a4937e2e4d1c625e6038c24f8beb47dd9a22dfbc0db7f915972",
      exactSchemaDefect: "_canonical_cpsc_record routed valid CPSC decision strings through _bounded_string, whose 256-character MAX_FIELD_LENGTH rejected Description (794), then Hazard Name (490) and Remedy Name (641).",
      actualDescriptionShape: { present: true, type: typeof CPSC_RECORD.Description, valueShape: "scalar string", unicodeLength: CPSC_RECORD.Description.length, utf8Bytes: new TextEncoder().encode(CPSC_RECORD.Description).length, null: CPSC_RECORD.Description === null, empty: CPSC_RECORD.Description.length === 0, value: CPSC_RECORD.Description },
      otherSchemaMismatchesFound: { "Hazards[0].Name": { type: typeof CPSC_RECORD.Hazards[0].Name, unicodeLength: CPSC_RECORD.Hazards[0].Name.length, oldLimit: 256 }, "Remedies[0].Name": { type: typeof CPSC_RECORD.Remedies[0].Name, unicodeLength: CPSC_RECORD.Remedies[0].Name.length, oldLimit: 256 } },
      schemaFix: "Added MAX_CPSC_FIELD_LENGTH=1024 and _bounded_cpsc_string, used only for decision-relevant CPSC fields; preserved the general 256-character bound and fail-closed type/length checks.",
      failClosedPreserved: true,
      oldSourceSha256: "5ccac7504d6f892e28244e842aa4a2545b69e2ee4d5008b68d90445cabdd888f",
      newSourceSha256: newSourceSha,
      newDeployTx: deployTx,
      newContractAddress: contract,
      registerTx,
      listingId: state.listingId,
      registeredBy: state.listing.owner,
      initialState: "UNASSESSED",
      challenger: CHALLENGER,
      assessmentTx: txHash,
      requestedBy: assessment.requested_by,
      recallIdentifier: assessment.recall_identifier,
      verdict: assessment.verdict,
      finalState: state.listing.state,
      history: { count: assessmentIds.length, ids: assessmentIds, assessments },
      attestation,
      transactionStatuses: {
        oldRegister: { tx: "0x7eb621fc21070e5ae7c13afa6cfed777644f5f4ba2dc47be6bb93bb45d86388d", status: "FINALIZED", execution: "FINISHED_WITH_RETURN" },
        oldFailedAssessment: { tx: "0x2410f57158d07a4937e2e4d1c625e6038c24f8beb47dd9a22dfbc0db7f915972", status: "FINALIZED", execution: "FINISHED_WITH_ERROR", error: "SOURCE:INVALID_SCHEMA_Description", assessmentRecordCreated: false },
        deploy: { tx: deployTx, status: "FINALIZED", execution: "FINISHED_WITH_RETURN" },
        register: { tx: registerTx, status: "FINALIZED", execution: "FINISHED_WITH_RETURN" },
        assessment: terminal,
      },
      liveReadback: { listing: state.listing, assessment, listingAssessments: assessmentIds, attestation },
      shutdownRecoveryNotes: "Schema-fix qualification followed the prior failed assessment. The old failed contract and transaction were preserved; this proof used a newly deployed contract and exactly one new registration and assessment broadcast.",
      proof,
    };
    persist(FINAL_EVIDENCE_PATH, evidence);
    persist(ASSESSMENT_TRACK_PATH, { ...terminal, contractAddress: contract, listing: state.listing, assessmentIds, assessments, attestation, proof, evidencePath: FINAL_EVIDENCE_PATH });
    console.log(json({ ...evidence, evidencePath: FINAL_EVIDENCE_PATH }));
    return;
  }

  throw new Error(`UNKNOWN_MODE:${mode}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
