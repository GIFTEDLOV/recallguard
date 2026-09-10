import { createGenLayerClient, CONTRACT_ADDRESS, GENLAYER_RPC_URL } from "../genlayer/client";
import { listingId } from "../canonical";
import { pendingTransactions, type PendingExpectation, type PendingTransaction } from "../transactions/persistence";
import type { Assessment, ContractInfo, Listing } from "../types";
import { isSuccessful as sdkIsSuccessful } from "genlayer-js";
import { TransactionHashVariant, type GenLayerTransaction } from "genlayer-js/types";
import { loadFeeProfile, profileEntry } from "../fees";

type Receipt = Record<string, any>;

export type TransactionStage =
  | "PRECONDITION_READ"
  | "FEE_QUOTED"
  | "SUBMISSION_SENT"
  | "HASH_PERSISTED"
  | "TRANSACTION_ACCEPTED"
  | "FINALITY_PENDING"
  | "FINALIZED"
  | "EXECUTION_VERIFIED"
  | "STATE_CONFIRMED"
  | "RECONCILING"
  | "FAILED";

export interface TransactionProgress {
  stage: TransactionStage;
  hash?: string;
  detail?: string;
}

export type TransactionProgressHandler = (progress: TransactionProgress) => void;

function plain(value: unknown): any {
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries(), ([key, entry]) => [key, plain(entry)]));
  }
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]));
  }
  return value;
}

function statusName(receipt: Receipt): string {
  if (typeof receipt.statusName === "string") return receipt.statusName.toUpperCase();
  if (typeof receipt.status === "string") return receipt.status.toUpperCase();
  return "";
}

/** Uses the official genlayer-js v2 success predicate. */
export function isSuccessfulTransaction(receipt: Receipt): boolean {
  if (!receipt || typeof receipt !== "object") return false;
  // `genlayer-js` also considers ACCEPTED + return a successful protocol
  // execution. Application completion is stricter: state-changing UI actions
  // are durable only after the required FINALIZED lifecycle state.
  return isFinalized(receipt) && sdkIsSuccessful(receipt as GenLayerTransaction);
}

function isFinalized(receipt: Receipt): boolean {
  return statusName(receipt) === "FINALIZED";
}

export class PendingTransactionError extends Error {
  constructor(public readonly hash: string, cause: unknown) {
    super(`Transaction ${hash} remains pending or needs reconciliation: ${String(cause)}`);
  }
}

export class FeePolicyUnavailableError extends Error {
  constructor() {
    super("TOOLCHAIN:GENLAYER_JS_V2_FEE_ESTIMATOR_REQUIRED");
  }
}

export class FinalizedExecutionError extends Error {
  constructor(public readonly receipt: Receipt) {
    super("TRANSACTION:FINALIZED_WITHOUT_FINISHED_WITH_RETURN");
  }
}

export class RecallGuardContract {
  private readonly address: `0x${string}`;
  private client: any;

  constructor(address: string = CONTRACT_ADDRESS, walletAddress?: string) {
    if (!address) throw new Error("CONFIGURATION:CONTRACT_ADDRESS_MISSING");
    this.address = address as `0x${string}`;
    this.client = createGenLayerClient(walletAddress);
  }

  private resetClient(walletAddress?: string): void {
    this.client = createGenLayerClient(walletAddress);
  }

  async getListingIds(): Promise<string[]> {
    const result = await this.client.readContract({ address: this.address, functionName: "get_listing_ids", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
    return Array.from(plain(result) || [], String);
  }

  async getAssessmentIds(): Promise<string[]> {
    const result = await this.client.readContract({ address: this.address, functionName: "get_assessment_ids", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
    return Array.from(plain(result) || [], String);
  }

  async getListing(id: string): Promise<Listing> {
    return plain(await this.client.readContract({ address: this.address, functionName: "get_listing", args: [id], transactionHashVariant: TransactionHashVariant.LATEST_FINAL })) as Listing;
  }

  async getAssessment(id: string): Promise<Assessment> {
    return plain(await this.client.readContract({ address: this.address, functionName: "get_assessment", args: [id], transactionHashVariant: TransactionHashVariant.LATEST_FINAL })) as Assessment;
  }

  async getListingAssessments(id: string): Promise<string[]> {
    const result = await this.client.readContract({ address: this.address, functionName: "get_listing_assessments", args: [id], transactionHashVariant: TransactionHashVariant.LATEST_FINAL });
    return Array.from(plain(result) || [], String);
  }

  async getAttestation(id: string): Promise<Assessment> {
    return plain(await this.client.readContract({ address: this.address, functionName: "get_attestation", args: [id], transactionHashVariant: TransactionHashVariant.LATEST_FINAL })) as Assessment;
  }

  async getContractInfo(): Promise<ContractInfo> {
    return plain(await this.client.readContract({ address: this.address, functionName: "contract_info", args: [], transactionHashVariant: TransactionHashVariant.LATEST_FINAL })) as ContractInfo;
  }

  async registerListing(input: {
    marketplaceHost: string;
    externalListingId: string;
    productId: string;
    productName: string;
    manufacturer: string;
    model: string;
    serialOrLot: string;
    listingUrl: string;
    walletAddress: string;
  }, onProgress?: TransactionProgressHandler): Promise<{ hash: string; listingId: string }> {
    this.resetClient(input.walletAddress);
    const id = await listingId(input);
    onProgress?.({ stage: "PRECONDITION_READ", detail: "Checking whether this marketplace reference already exists" });
    const existingIds = await this.getListingIds();
    if (existingIds.includes(id)) throw new Error("EXPECTED:DUPLICATE_LISTING");

    const args = [input.marketplaceHost, input.externalListingId, input.productId, input.productName, input.manufacturer, input.model, input.serialOrLot, input.listingUrl];
    const result = await this.executeWrite("register_listing", args, { listingId: id }, async () => {
      const listing = await this.getListing(id);
      if (listing.id !== id || listing.state !== "UNASSESSED") throw new Error("STATE:REGISTRATION_READBACK_MISMATCH");
    }, onProgress);
    return { hash: result.hash, listingId: id };
  }

  async requestAssessment(input: {
    listingId: string;
    recallIdentifier: string;
    walletAddress: string;
  }, onProgress?: TransactionProgressHandler): Promise<{ hash: string; assessmentId: string }> {
    this.resetClient(input.walletAddress);
    onProgress?.({ stage: "PRECONDITION_READ", detail: "Reading the listing before permissionless submission" });
    await this.getListing(input.listingId);
    const args = [input.listingId, input.recallIdentifier];
    const result = await this.executeWrite("request_assessment", args, { listingId: input.listingId, recallIdentifier: input.recallIdentifier }, async () => {
      const assessmentIds = await this.getListingAssessments(input.listingId);
      const assessments = await Promise.all(assessmentIds.map((id) => this.getAssessment(id)));
      const matching = assessments.find((assessment) => assessment.recall_identifier === input.recallIdentifier.trim().toUpperCase());
      const listing = await this.getListing(input.listingId);
      if (!matching || matching.listing_id !== input.listingId || !listing.state) {
        throw new Error("STATE:ASSESSMENT_READBACK_MISMATCH");
      }
    }, onProgress);
    const assessmentIds = await this.getListingAssessments(input.listingId);
    const assessments = await Promise.all(assessmentIds.map((id) => this.getAssessment(id)));
    const matching = assessments.find((assessment) => assessment.recall_identifier === input.recallIdentifier.trim().toUpperCase());
    if (!matching) throw new PendingTransactionError(result.hash, "successful transaction had no matching assessment readback");
    return { hash: result.hash, assessmentId: matching.id };
  }

  listPendingTransactions(): PendingTransaction[] {
    return pendingTransactions.list();
  }

  async reconcilePending(hash: string, onProgress?: TransactionProgressHandler): Promise<Receipt> {
    const pending = pendingTransactions.list().find((entry) => entry.hash === hash);
    if (!pending) throw new Error(`EXPECTED:NO_PERSISTED_TRANSACTION:${hash}`);
    onProgress?.({ stage: "RECONCILING", hash, detail: "Reconnecting to the existing transaction" });
    const receipt = await this.waitForFinalization(hash);
    if (!isSuccessfulTransaction(receipt)) {
      if (isFinalized(receipt)) pendingTransactions.update(hash, { status: "FINALIZED_FAILURE" });
      onProgress?.({ stage: "FAILED", hash, detail: "The transaction did not finish with a successful contract return" });
      throw new FinalizedExecutionError(receipt);
    }
    onProgress?.({ stage: "FINALIZED", hash });
    onProgress?.({ stage: "EXECUTION_VERIFIED", hash });
    try {
      await this.verifyExpectedState(pending.expected);
      pendingTransactions.confirm(hash);
      onProgress?.({ stage: "STATE_CONFIRMED", hash });
      return receipt;
    } catch (error) {
      pendingTransactions.update(hash, { status: "RECONCILIATION_REQUIRED" });
      onProgress?.({ stage: "FAILED", hash, detail: String(error) });
      throw new PendingTransactionError(hash, error);
    }
  }

  private async verifyExpectedState(expected?: PendingExpectation): Promise<void> {
    if (expected?.listingId && expected.recallIdentifier) {
      const assessmentIds = await this.getListingAssessments(expected.listingId);
      const assessments = await Promise.all(assessmentIds.map((id) => this.getAssessment(id)));
      const normalizedRecall = expected.recallIdentifier.trim().toUpperCase();
      if (!assessments.some((assessment) => assessment.recall_identifier === normalizedRecall && assessment.listing_id === expected.listingId)) {
        throw new Error("STATE:ASSESSMENT_READBACK_MISMATCH");
      }
      return;
    }
    if (expected?.listingId) {
      const listing = await this.getListing(expected.listingId);
      if (listing.id !== expected.listingId) throw new Error("STATE:LISTING_READBACK_MISMATCH");
      return;
    }
    throw new Error("STATE:NO_EXPECTED_STATE_DESCRIPTOR");
  }

  private async waitForFinalization(hash: string): Promise<Receipt> {
    return plain(await this.client.waitForFinalization({ hash, retries: 120, interval: 5000, fullTransaction: true }));
  }

  private async quoteFees(method: string): Promise<Record<string, unknown>> {
    const profile = await loadFeeProfile();
    const entry = profileEntry(profile, method as "register_listing" | "request_assessment");
    if (typeof this.client.estimateTransactionFees !== "function") throw new FeePolicyUnavailableError();
    const appealRounds = Number(entry.appealRounds ?? 1);
    const rotationsPerRound = BigInt(entry.rotationsPerRound);
    const estimate = await this.client.estimateTransactionFees({
      leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
      validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
      executionBudgetPerRound: BigInt(entry.executionBudgetPerRound),
      totalMessageFees: BigInt(entry.totalMessageFees ?? "0"),
      appealRounds: BigInt(appealRounds),
      rotations: Array.from({ length: appealRounds + 1 }, () => rotationsPerRound),
    });
    if (!estimate || !estimate.distribution || estimate.feeValue === undefined) {
      throw new FeePolicyUnavailableError();
    }
    return { distribution: estimate.distribution, feeValue: estimate.feeValue };
  }

  private async executeWrite(method: string, args: unknown[], expected: PendingExpectation, expectedState: () => Promise<void>, onProgress?: TransactionProgressHandler): Promise<{ hash: string; receipt: Receipt }> {
    // This is the only application broadcast path. Once the SDK returns a
    // GenLayer transaction ID, all later failures reconcile that same ID.
    await this.client.connect("testnetBradbury");
    onProgress?.({ stage: "PRECONDITION_READ", detail: "Network and contract preconditions satisfied" });
    let quote: Record<string, unknown>;
    try {
      quote = await this.quoteFees(method);
    } catch (error) {
      onProgress?.({ stage: "FAILED", detail: String(error) });
      throw error;
    }
    onProgress?.({ stage: "FEE_QUOTED", detail: "Current network fee policy returned by the SDK" });

    let hash: string;
    try {
      hash = await this.client.writeContract({
        address: this.address,
        functionName: method,
        args,
        value: BigInt(0),
        fees: quote,
      });
    } catch (error) {
      onProgress?.({ stage: "FAILED", detail: String(error) });
      throw new SubmissionRejectedError(error);
    }
    onProgress?.({ stage: "SUBMISSION_SENT", hash });
    // Persist before any polling, rendering, or readback. This is the point
    // after which a timeout must never trigger a blind rebroadcast.
    pendingTransactions.save({ hash, method, args, expected, status: "SUBMITTED", createdAt: new Date().toISOString() });
    onProgress?.({ stage: "HASH_PERSISTED", hash });

    try {
      onProgress?.({ stage: "FINALITY_PENDING", hash });
      const receipt = await this.waitForFinalization(hash);
      if (!isSuccessfulTransaction(receipt)) {
        if (isFinalized(receipt)) pendingTransactions.update(hash, { status: "FINALIZED_FAILURE" });
        onProgress?.({ stage: "FAILED", hash, detail: "Finalized without FINISHED_WITH_RETURN" });
        throw new FinalizedExecutionError(receipt);
      }
      onProgress?.({ stage: "TRANSACTION_ACCEPTED", hash });
      onProgress?.({ stage: "FINALIZED", hash });
      onProgress?.({ stage: "EXECUTION_VERIFIED", hash });
      await expectedState();
      pendingTransactions.confirm(hash);
      onProgress?.({ stage: "STATE_CONFIRMED", hash });
      return { hash, receipt };
    } catch (error) {
      if (error instanceof FinalizedExecutionError) throw error;
      pendingTransactions.update(hash, { status: "RECONCILIATION_REQUIRED" });
      onProgress?.({ stage: "FAILED", hash, detail: String(error) });
      throw new PendingTransactionError(hash, error);
    }
  }
}

export class SubmissionRejectedError extends Error {
  public readonly data: unknown;
  public readonly code: unknown;

  constructor(cause: unknown) {
    const record = cause && typeof cause === "object" ? cause as Record<string, unknown> : {};
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Broadcast did not return a GenLayer transaction ID: ${message}`, { cause });
    this.name = "SubmissionRejectedError";
    this.data = record.data;
    this.code = record.code;
  }
}

export const recallGuardRpc = GENLAYER_RPC_URL;
