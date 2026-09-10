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
  /** Informational/navigation URL. It is not consensus evidence. */
  listing_url: string;
  identity_version: string;
  state: ListingState;
}

export interface Assessment {
  id: string;
  listing_id: string;
  notice_id: string;
  recall_identifier: string;
  snapshot_id: string;
  requested_by: string;
  recall_source: string;
  snapshot_sha256: string;
  verdict: Verdict;
  state_after: ListingState;
  status: "ADJUDICATED";
  authoritative_source: string;
  source_policy_version: string;
}

export interface ContractInfo {
  name: string;
  version: string;
  verdict_enum: Verdict[];
  listing_state_enum: ListingState[];
  max_cpsc_response_bytes: number;
  raw_cpsc_body_stored: boolean;
  marketplace_evidence_in_consensus: boolean;
  source_authenticity_semantics: string;
  semantic_question: string;
  authorized_recall_domains: string[];
  authorized_marketplace_domains: string[];
  identity_version: string;
  notice_identity_version: string;
  snapshot_id_version: string;
  source_policy_version: string;
  assessment_aggregation: string;
  duplicate_notice_policy: string;
  assessment_record_status: "ADJUDICATED";
  notice_snapshot_policy: string;
  administrator_exists: boolean;
  cpsc_authority: string;
  cpsc_host: string;
  cpsc_path: string;
}
