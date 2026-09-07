import { createGenLayerClient, CONTRACT_ADDRESS, GENLAYER_RPC_URL } from "../genlayer/client";
import { assessmentId, listingId } from "../canonical";
import { pendingTransactions, type PendingExpectation, type PendingTransaction } from "../transactions/persistence";
import type { Assessment, ContractInfo, Listing } from "../types";

type Receipt = Record<string, any>;

export type TransactionStage =
  | "PRECONDITION_READ"
  | "TRANSACTION_SIGNED"
  | "SUBMISSION_SENT"
  | "HASH_PERSISTED"
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

function isFinalized(receipt: Receipt): boolean {
  return receipt.statusName === "FINALIZED" || receipt.status === 6;
}

function executionSucceeded(receipt: Receipt): boolean {
  if (!isFinalized(receipt)) return false;
  if (receipt.txExecutionResultName) return receipt.txExecutionResultName === "FINISHED_WITH_RETURN";
  const result = receipt.consensus_data?.leader_receipt?.[0]?.execution_result;
  return result === "SUCCESS";
}

export class PendingTransactionError extends Error {
  constructor(public readonly hash: string, cause: unknown) {
    super(`Transaction ${hash} remains pending or needs reconciliation: ${String(cause)}`);
  }
}

export class RecallGuardContract {
  private readonly address: `0x${string}`;
  private client: any;

  constructor(address: string = CONTRACT_ADDRESS, walletAddress?: string) {
    if (!address) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not configured");
    this.address = address as `0x${string}`;
    this.client = createGenLayerClient(walletAddress);
  }

  private resetClient(walletAddress?: string): void {
    this.client = createGenLayerClient(walletAddress);
  }

  async getListingIds(): Promise<string[]> {
    const result = await this.client.readContract({ address: this.address, functionName: "get_listing_ids", args: [] });
    return Array.from(plain(result) || [], String);
  }

  async getAssessmentIds(): Promise<string[]> {
    const result = await this.client.readContract({ address: this.address, functionName: "get_assessment_ids", args: [] });
    return Array.from(plain(result) || [], String);
  }

  async getListing(id: string): Promise<Listing> {
    return plain(await this.client.readContract({ address: this.address, functionName: "get_listing", args: [id] })) as Listing;
  }

  async getAssessment(id: string): Promise<Assessment> {
    return plain(await this.client.readContract({ address: this.address, functionName: "get_assessment", args: [id] })) as Assessment;
  }

  async getAttestation(id: string): Promise<Assessment> {
    return plain(await this.client.readContract({ address: this.address, functionName: "get_attestation", args: [id] })) as Assessment;
  }

  async getContractInfo(): Promise<ContractInfo> {
    return plain(await this.client.readContract({ address: this.address, functionName: "contract_info", args: [] })) as ContractInfo;
  }

  async registerListing(input: {
    productId: string;
    productName: string;
    manufacturer: string;
    model: string;
    serialOrLot: string;
    listingUrl: string;
    evidenceUrl: string;
    evidenceSha256: string;
    walletAddress: string;
  }, onProgress?: TransactionProgressHandler): Promise<{ hash: string; listingId: string }> {
    this.resetClient(input.walletAddress);
    const id = await listingId(input);
    onProgress?.({ stage: "PRECONDITION_READ", detail: "Checking whether this listing already exists" });
    const existingIds = await this.getListingIds();
    if (existingIds.includes(id)) throw new Error("BUSINESS:DUPLICATE_LISTING");

    const args = [input.productId, input.productName, input.manufacturer, input.model, input.serialOrLot, input.listingUrl, input.evidenceUrl, input.evidenceSha256];
    const result = await this.executeWrite("register_listing", args, { listingId: id }, async () => {
      const listing = await this.getListing(id);
      if (listing.id !== id) throw new Error("Expected listing state was not found after finality");
    }, onProgress);
    return { hash: result.hash, listingId: id };
  }

  async requestAssessment(input: {
    listingId: string;
    recallUrl: string;
    recallSha256: string;
    walletAddress: string;
  }, onProgress?: TransactionProgressHandler): Promise<{ hash: string; assessmentId: string }> {
    this.resetClient(input.walletAddress);
    onProgress?.({ stage: "PRECONDITION_READ", detail: "Reading the listing before assessment" });
    const before = await this.getListing(input.listingId);
    if (before.state === "BLOCKED") throw new Error("BUSINESS:ILLEGAL_STATE_TRANSITION");
    const id = await assessmentId(input.listingId, input.recallUrl, input.recallSha256, before.evidence_sha256);
    const args = [input.listingId, input.recallUrl, input.recallSha256];
    const result = await this.executeWrite("request_assessment", args, { listingId: input.listingId, assessmentId: id }, async () => {
      const assessment = await this.getAssessment(id);
      const listing = await this.getListing(input.listingId);
      if (assessment.id !== id || assessment.listing_id !== input.listingId || !listing.state) {
        throw new Error("Expected assessment/listing state was not found after finality");
      }
    }, onProgress);
    return { hash: result.hash, assessmentId: id };
  }

  listPendingTransactions(): PendingTransaction[] {
    return pendingTransactions.list();
  }

  async reconcilePending(hash: string, onProgress?: TransactionProgressHandler): Promise<Receipt> {
    const pending = pendingTransactions.list().find((entry) => entry.hash === hash);
    if (!pending) throw new Error(`No persisted transaction found for ${hash}`);
    onProgress?.({ stage: "RECONCILING", hash, detail: "Reconnecting to the existing transaction" });
    const receipt = await this.client.waitForTransactionReceipt({ hash, status: "FINALIZED", retries: 120, interval: 5000 });
    if (!executionSucceeded(receipt)) {
      pendingTransactions.update(hash, { status: "FINALIZED_FAILURE" });
      onProgress?.({ stage: "FAILED", hash, detail: "Finalized without evidenced execution success" });
      throw new PendingTransactionError(hash, "finalized without evidenced execution success");
    }
    onProgress?.({ stage: "FINALIZED", hash });
    onProgress?.({ stage: "EXECUTION_VERIFIED", hash });
    try {
      await this.verifyExpectedState(pending.expected);
      pendingTransactions.remove(hash);
      onProgress?.({ stage: "STATE_CONFIRMED", hash });
      return receipt;
    } catch (error) {
      pendingTransactions.update(hash, { status: "RECONCILIATION_REQUIRED" });
      onProgress?.({ stage: "FAILED", hash, detail: String(error) });
      throw new PendingTransactionError(hash, error);
    }
  }

  private async verifyExpectedState(expected?: PendingExpectation): Promise<void> {
    if (expected?.assessmentId && expected.listingId) {
      const assessment = await this.getAssessment(expected.assessmentId);
      const listing = await this.getListing(expected.listingId);
      if (assessment.id !== expected.assessmentId || assessment.listing_id !== expected.listingId || !listing.state) {
        throw new Error("Expected assessment/listing state was not found after finality");
      }
      return;
    }
    if (expected?.listingId) {
      const listing = await this.getListing(expected.listingId);
      if (listing.id !== expected.listingId) throw new Error("Expected listing state was not found after finality");
      return;
    }
    throw new Error("No persisted expected state descriptor is available");
  }

  private async executeWrite(method: string, args: unknown[], expected: PendingExpectation, expectedState: () => Promise<void>, onProgress?: TransactionProgressHandler): Promise<{ hash: string; receipt: Receipt }> {
    // This method is intentionally the only broadcast path. It writes the
    // returned hash before any receipt polling and never retries broadcasting.
    let hash: string;
    try {
      // Network selection is a precondition. It must happen before the only
      // broadcast so an RPC ambiguity cannot cause a second wallet request.
      await this.client.connect("testnetBradbury");
      hash = await this.client.writeContract({ address: this.address, functionName: method, args, value: BigInt(0) });
      onProgress?.({ stage: "TRANSACTION_SIGNED", hash });
      onProgress?.({ stage: "SUBMISSION_SENT", hash });
    } catch (error) {
      onProgress?.({ stage: "FAILED", detail: String(error) });
      throw new Error(`Broadcast failed before a hash was returned: ${String(error)}`);
    }
    pendingTransactions.save({ hash, method, args, expected, status: "PROVISIONAL", createdAt: new Date().toISOString() });
    onProgress?.({ stage: "HASH_PERSISTED", hash });

    try {
      onProgress?.({ stage: "FINALITY_PENDING", hash });
      const receipt = await this.client.waitForTransactionReceipt({ hash, status: "FINALIZED", retries: 120, interval: 5000 });
      if (!executionSucceeded(receipt)) {
        pendingTransactions.update(hash, { status: "FINALIZED_FAILURE" });
        onProgress?.({ stage: "FAILED", hash, detail: "Finalized without evidenced execution success" });
        throw new Error(`Finalized transaction did not prove successful execution: ${JSON.stringify(receipt)}`);
      }
      onProgress?.({ stage: "FINALIZED", hash });
      onProgress?.({ stage: "EXECUTION_VERIFIED", hash });
      await expectedState();
      pendingTransactions.remove(hash);
      onProgress?.({ stage: "STATE_CONFIRMED", hash });
      return { hash, receipt };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Finalized transaction did not prove")) throw error;
      pendingTransactions.update(hash, { status: "RECONCILIATION_REQUIRED" });
      onProgress?.({ stage: "FAILED", hash, detail: String(error) });
      throw new PendingTransactionError(hash, error);
    }
  }
}

export const recallGuardRpc = GENLAYER_RPC_URL;
