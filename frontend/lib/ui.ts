import type { ListingState, Verdict } from "./types";

export const stateLabels: Record<ListingState, string> = {
  UNASSESSED: "Not yet assessed",
  CLEARED: "Cleared by consensus",
  REVIEW_REQUIRED: "Review required",
  BLOCKED: "Blocked",
};

export const verdictLabels: Record<Verdict, string> = {
  AFFECTED: "Affected",
  NOT_AFFECTED: "Not affected",
  INCONCLUSIVE: "Inconclusive",
};

export type StateTone = "neutral" | "positive" | "caution" | "danger";

export function toneForState(state: ListingState): StateTone {
  if (state === "CLEARED") return "positive";
  if (state === "REVIEW_REQUIRED") return "caution";
  if (state === "BLOCKED") return "danger";
  return "neutral";
}

export function stateExplanation(state: ListingState): string {
  if (state === "UNASSESSED") return "No consensus assessment exists yet.";
  if (state === "CLEARED") return "Cleared by consensus against the recorded assessments and registered facts.";
  if (state === "REVIEW_REQUIRED") return "An admissible but inconclusive assessment remains relevant.";
  return "An affected assessment remains relevant; a later favorable result cannot unblock this record.";
}

export function challengePath(listingId: string): string {
  return `/app/listings/${encodeURIComponent(listingId)}/check`;
}

export const challengeActionLabel = "Check against a recall";

export function labelForState(state: ListingState): string { return stateLabels[state] || state; }
export function labelForVerdict(verdict: Verdict): string { return verdictLabels[verdict] || verdict; }

export function shortHash(value: string, start = 8, end = 6): string {
  if (!value || value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function hostFromUrl(value: string): string {
  try { return new URL(value).host; } catch { return value; }
}

function structuredCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const candidate = error as Record<string, unknown>;
  const data = candidate.data && typeof candidate.data === "object" ? candidate.data as Record<string, unknown> : undefined;
  const cause = candidate.cause;
  for (const value of [candidate.code, candidate.name, data?.code, data?.errorCode, data?.name]) {
    if (typeof value === "string" && value) return value.toUpperCase();
  }
  return cause ? structuredCode(cause) : "";
}

/** Classify structured protocol/RPC data first, with text as a compatibility fallback. */
export function humanizeError(error: unknown): { title: string; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const code = structuredCode(error);
  const signal = `${code} ${raw}`.toUpperCase();

  if (signal.includes("WRONG_CHAIN") || signal.includes("CHAIN_MISMATCH") || signal.includes("WRONG_NETWORK")) {
    return { title: "Wrong network", message: "Switch to the configured GenLayer network before submitting." };
  }
  if (signal.includes("WALLET") || signal.includes("USER_REJECTED") || signal.includes("ACCOUNT_DISCONNECTED")) {
    return { title: "Wallet connection required", message: "Reconnect the wallet on the configured GenLayer network. No application write was broadcast." };
  }
  if (signal.includes("FEE") || signal.includes("INSUFFICIENT_FUNDS") || signal.includes("INSUFFICIENT_BALANCE")) {
    return { title: "Insufficient fee or balance", message: "The current fee quote or wallet balance is not sufficient. Re-quote before signing." };
  }
  if (signal.includes("SOURCE:") || signal.includes("CPSC_HTTP") || signal.includes("INVALID_SCHEMA") || signal.includes("RECALL_NOT_FOUND")) {
    return { title: "Source unavailable or inadmissible", message: "The authoritative CPSC record did not satisfy the fixed source and schema policy. No safety verdict was recorded." };
  }
  if (signal.includes("TRANSIENT:") || signal.includes("TIMEOUT") || signal.includes("FETCH_FAILED")) {
    return { title: "Source temporarily unavailable", message: "The official CPSC source could not be retrieved. No safety verdict was recorded; reconcile the same transaction before retrying." };
  }
  if (signal.includes("SEMANTIC:") || signal.includes("MALFORMED_OUTPUT") || signal.includes("MODEL_")) {
    return { title: "Assessment could not be interpreted", message: "The evaluator response did not match the strict three-value decision schema. No safety verdict was recorded." };
  }
  if (signal.includes("CONSENSUS:") || signal.includes("DISAGREEMENT") || signal.includes("UNDETERMINED")) {
    return { title: "Consensus not reached", message: "Validators did not reach the required agreement. The listing safety state was not changed by this assessment." };
  }
  if (signal.includes("FINALIZED_WITHOUT_FINISHED_WITH_RETURN") || signal.includes("FINISHED_WITH_ERROR") || signal.includes("TRANSACTION:")) {
    return { title: "Transaction failed", message: "The transaction reached a terminal protocol state without a successful contract return. No application state change is treated as complete." };
  }
  if (signal.includes("RECONCILIATION") || signal.includes("PENDING")) {
    return { title: "Transaction needs reconciliation", message: "The same transaction ID was preserved. Reconcile it before considering the action complete; no replacement was broadcast." };
  }
  if (signal.includes("INPUT:") || signal.includes("EXPECTED:INVALID") || signal.includes("REQUIRED")) {
    return { title: "Input error", message: "Check the required listing and CPSC recall identifier fields." };
  }
  if (signal.includes("STATE:")) {
    return { title: "Application state conflict", message: "The contract state did not match the expected readback. The transaction ID remains available for reconciliation." };
  }
  if (signal.includes("CONFIGURATION:")) {
    return { title: "Configuration required", message: "This workspace is not connected to a configured RecallGuard V2 contract." };
  }
  return { title: "Could not complete request", message: raw.replace(/^Error:\s*/i, "") };
}

export function isConfigured(): boolean { return Boolean(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS); }
