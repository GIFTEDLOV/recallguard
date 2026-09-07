export type Verdict = "AFFECTED" | "NOT_AFFECTED" | "INCONCLUSIVE";
export type ListingState = "ACTIVE" | "RECALL_REVIEW" | "BLOCKED";

export interface Listing {
  id: string;
  owner: string;
  product_id: string;
  product_name: string;
  manufacturer: string;
  model: string;
  serial_or_lot: string;
  listing_url: string;
  evidence_url: string;
  evidence_sha256: string;
  state: ListingState;
}

export interface Assessment {
  id: string;
  listing_id: string;
  requested_by: string;
  recall_url: string;
  recall_sha256: string;
  listing_evidence_sha256: string;
  verdict: Verdict;
  state_after: ListingState;
  status: "FINALIZED";
  authoritative_source_semantics: "MUTABLE_AUTHORITATIVE_SOURCE";
}

export interface ContractInfo {
  name: string;
  version: string;
  verdict_enum: Verdict[];
  listing_state_enum: ListingState[];
  max_evidence_bytes: number;
  authoritative_source_semantics: string;
  authorized_recall_domains: string[];
}
