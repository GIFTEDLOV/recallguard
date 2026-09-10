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
  if (state === "CLEARED") return "At least one consensus-backed assessment exists and all recorded relevant results are not affected.";
  if (state === "REVIEW_REQUIRED") return "An inconclusive recorded assessment remains relevant.";
  return "An affected recorded assessment remains relevant.";
}

export function challengePath(listingId: string): string {
  return `/app/listings/${encodeURIComponent(listingId)}/check`;
}

export const challengeActionLabel = "Check against a recall";

export function labelForState(state: ListingState): string {
  return stateLabels[state] || state;
}

export function labelForVerdict(verdict: Verdict): string {
  return verdictLabels[verdict] || verdict;
}

export function shortHash(value: string, start = 8, end = 6): string {
  if (!value || value.length <= start + end + 1) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

export function hostFromUrl(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

export function humanizeError(error: unknown): { title: string; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.toLowerCase();

  if (normalized.includes("evidence_unavailable") || normalized.includes("timeout_or_fetch_failure")) {
    return { title: "Evidence unavailable", message: "The official recall source could not be retrieved. No safety verdict was recorded." };
  }
  if (normalized.includes("evidence_integrity") || normalized.includes("wrong_source_domain")) {
    return { title: "Evidence integrity failure", message: "The retrieved evidence did not satisfy the configured source policy or committed hash. No safety verdict was recorded." };
  }
  if (normalized.includes("consensus") || normalized.includes("disagreement")) {
    return { title: "Consensus not reached", message: "Validators did not reach the required agreement. The listing safety state was not changed by this assessment." };
  }
  if (normalized.includes("semantic_model") || normalized.includes("malformed_output")) {
    return { title: "Assessment could not be interpreted", message: "The evaluator response did not match the contract's strict decision schema. No safety verdict was recorded." };
  }
  if (normalized.includes("finalized transaction did not prove") || normalized.includes("execution failure")) {
    return { title: "Execution failed", message: "The transaction reached the network but did not complete successfully." };
  }
  if (normalized.includes("network") || normalized.includes("chain") || normalized.includes("switch")) {
    return { title: "Wrong network", message: "Switch to the configured GenLayer network to continue." };
  }
  if (normalized.includes("pending") || normalized.includes("reconciliation")) {
    return { title: "Transaction needs reconciliation", message: "The same transaction hash was preserved. Reconcile it before considering the action complete; no new transaction was broadcast." };
  }
  if (normalized.includes("wallet") && (normalized.includes("disconnect") || normalized.includes("connect"))) {
    return { title: "Wallet connection required", message: "Reconnect a wallet on the configured GenLayer network. No transaction was broadcast." };
  }
  if (normalized.includes("duplicate")) {
    return { title: "Already registered", message: "This record already exists on the contract." };
  }
  if (normalized.includes("unauthorized")) {
    return { title: "Wallet not authorized", message: "This wallet cannot perform that operation." };
  }
  return { title: "Could not complete request", message: raw.replace(/^Error:\s*/i, "") };
}

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
}
