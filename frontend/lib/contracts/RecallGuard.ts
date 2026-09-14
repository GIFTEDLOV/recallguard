import { createGenLayerClient, CONTRACT_ADDRESS, GENLAYER_RPC_URL } from "../genlayer/client";
import { loadFeeProfile, profileEntry, type FeeProfileEntry } from "../fees";
import { listingId } from "../canonical";
import { pendingTransactions, type PendingExpectation, type PendingTransaction } from "../transactions/persistence";
import type { Assessment, ContractInfo, Listing } from "../types";
import { TransactionHashVariant } from "genlayer-js/types";

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
  if (receipt.status === 7) return "FINALIZED";
  return "";
}

/** Durable application completion requires finality and a successful return. */
export function isSuccessfulTransaction(receipt: Receipt): boolean {
  if (!receipt || typeof receipt !== "object") return false;
  if (!isFinalized(receipt)) return false;
  if (typeof receipt.txExecutionResultName === "string") return receipt.txExecutionResultName.toUpperCase() === "FINISHED_WITH_RETURN";
  return receipt.txExecutionResult === 1 || receipt.txExecutionResult === "1";
}

function isFinalized(receipt: Receipt): boolean {
  return statusName(receipt) === "FINALIZED";
}

export class PendingTransactionError extends Error {
  constructor(public readonly hash: string, cause: unknown) {
    super(`Transaction ${hash} remains pending or needs reconciliation: ${String(cause)}`);
  }
}

export class FinalizedExecutionError extends Error {
  constructor(public readonly receipt: Receipt) {
    super("TRANSACTION:FINALIZED_WITHOUT_FINISHED_WITH_RETURN");
  }
}

function feeEstimateOptions(entry: FeeProfileEntry): Record<string, bigint | bigint[]> {
  const options: Record<string, bigint | bigint[]> = {
    leaderTimeunitsAllocation: BigInt(entry.leaderTimeunitsAllocation),
    validatorTimeunitsAllocation: BigInt(entry.validatorTimeunitsAllocation),
    executionBudgetPerRound: BigInt(entry.executionBudgetPerRound),
    totalMessageFees: BigInt(entry.totalMessageFees),
    rotations: [BigInt(entry.rotationsPerRound)],
  };
  if (entry.appealRounds !== undefined) options.appealRounds = BigInt(entry.appealRounds);
  return options;
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
    return plain(await this.client.waitForTransactionReceipt({ hash, status: "FINALIZED", retries: 120, interval: 5000 }));
  }

  private async executeWrite(method: string, args: unknown[], expected: PendingExpectation, expectedState: () => Promise<void>, onProgress?: TransactionProgressHandler): Promise<{ hash: string; receipt: Receipt }> {
    // This is the only application broadcast path. Once the SDK returns a
    // GenLayer transaction ID, all later failures reconcile that same ID.
    await this.client.connect("studioDevnet");
    onProgress?.({ stage: "PRECONDITION_READ", detail: "Network and contract preconditions satisfied" });

    let hash: string;
    try {
      const profile = await loadFeeProfile();
      const entry = profileEntry(profile, method as "register_listing" | "request_assessment");
      const estimate = await this.client.estimateTransactionFees(feeEstimateOptions(entry));
      onProgress?.({ stage: "FEE_QUOTED", detail: "Current Studio-dev fee policy applied to the measured RC allocation" });
      const returnedHash = await this.client.writeContract({
        address: this.address,
        functionName: method,
        args,
        value: BigInt(0),
        fees: {
          distribution: estimate.distribution,
          feeValue: estimate.feeValue,
        },
      });
      if (typeof returnedHash !== "string" || !returnedHash) throw new Error("Broadcast returned no GenLayer transaction ID");
      hash = returnedHash;
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
