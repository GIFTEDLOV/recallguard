export type Verdict = "AFFECTED" | "NOT_AFFECTED" | "INCONCLUSIVE";
export type ListingState = "UNASSESSED" | "CLEARED" | "REVIEW_REQUIRED" | "BLOCKED";

export interface Listing {
  id: string;
  owner: string;
  marketplace_host: string;
  external_listing_id: string;
  product_id: string;
  product_name: string;
  manufacturer: string;
  model: string;
  serial_or_lot: string;
  listing_url: string;
  evidence_url: string;
  evidence_sha256: string;
  identity_version: string;
  state: ListingState;
}

export interface Assessment {
  id: string;
  listing_id: string;
  notice_id: string;
  requested_by: string;
  recall_url: string;
  recall_sha256: string;
  listing_evidence_sha256: string;
  verdict: Verdict;
  state_after: ListingState;
  status: "FINALIZED";
  authoritative_source_semantics: "ALLOWLISTED_MUTABLE_AUTHORITATIVE_SOURCE";
}

export interface ContractInfo {
  name: string;
  version: string;
  verdict_enum: Verdict[];
  listing_state_enum: ListingState[];
  max_evidence_bytes: number;
  authoritative_source_semantics: string;
  authorized_recall_domains: string[];
  authorized_marketplace_domains: string[];
  authorized_listing_evidence_domains: string[];
  identity_version: string;
  assessment_aggregation: string;
  duplicate_notice_policy: string;
}
