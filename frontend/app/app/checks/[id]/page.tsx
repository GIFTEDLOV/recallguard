"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../../components/StatusBadge";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { pendingTransactions } from "../../../../lib/transactions/persistence";
import { hostFromUrl, humanizeError, shortHash } from "../../../../lib/ui";

export default function CheckDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id || "");
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const assessment = assessments.find((item) => item.id === id);
  const listing = assessment ? listings.find((item) => item.id === assessment.listing_id) : undefined;
  const [observedTxHash, setObservedTxHash] = useState("");

  useEffect(() => {
    if (!assessment) return;
    setObservedTxHash(pendingTransactions.confirmed().find((entry) => entry.expected?.assessmentId === assessment.id)?.hash || "");
  }, [assessment?.id]);

  if (!configured) return <div className="page-stack"><Notice tone="warning" title="Contract address required">Assessment records are read directly from RecallGuard after deployment.</Notice></div>;
  if (loading) return <div className="page-stack"><div className="skeleton-hero" /><div className="skeleton-panel" /></div>;
  if (error) return <div className="page-stack"><Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice></div>;
  if (!assessment) return <div className="page-stack"><div className="back-link"><Link href="/app/assessments"><Icon name="arrow" size={14} />Back to attestations</Link></div><section className="surface"><EmptyState icon="search" title="Assessment not found" body="No finalized contract record matched this assessment ID." action={<Link className="button button-secondary" href="/app/assessments">Return to attestations</Link>} /></section></div>;

  const title = assessment.verdict === "AFFECTED" ? "Affected scope confirmed" : assessment.verdict === "INCONCLUSIVE" ? "Review required" : "No affected scope found";
  return <div className="page-stack">
    <div className="back-link"><Link href="/app/assessments"><Icon name="arrow" size={14} />Back to attestations</Link></div>
    <section className={`assessment-hero verdict-${assessment.verdict.toLowerCase()}`}><div><div className="eyebrow">Finalized assessment attestation</div><h2>{title}</h2><p>{listing?.product_name || "Tracked listing"} · {listing?.model || shortHash(assessment.listing_id)}</p></div><div className="assessment-hero-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div></section>
    <div className="detail-id-row"><span>Assessment ID</span><code>{assessment.id}</code></div>
    <section className="content-grid detail-grid-layout"><div className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Decision record</div><h3>What RecallGuard stored</h3></div></div><div className="decision-statement"><div className="decision-check"><Icon name="shield" size={24} /></div><div><strong>{assessment.verdict === "AFFECTED" ? "This listing is within the affected scope." : assessment.verdict === "INCONCLUSIVE" ? "The evidence was not sufficient to establish applicability." : "This listing was not found within the affected scope."}</strong><p>Resulting state: <b>{assessment.state_after}</b>. This is the finalized contract value; the frontend does not derive or soften it.</p></div></div><div className="source-card"><div className="source-card-icon"><Icon name="link" size={17} /></div><div><span>Recall authority</span><strong>{hostFromUrl(assessment.recall_url)}</strong><a href={assessment.recall_url} target="_blank" rel="noreferrer">Open notice source <Icon name="external" size={13} /></a></div></div></div><div className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Finalized consequence</div><h3>Listing status</h3></div></div><div className="state-outcome"><StateBadge state={assessment.state_after} /><p>{assessment.state_after === "BLOCKED" ? "Blocked: an affected assessment remains relevant even if later notices are favorable." : assessment.state_after === "REVIEW_REQUIRED" ? "Review required: an inconclusive finalized assessment remains relevant." : assessment.state_after === "CLEARED" ? "Cleared by consensus: at least one finalized assessment exists and all relevant recorded results are not affected." : "Not yet assessed: no successful consensus-backed assessment exists."}</p></div>{listing && <Link className="text-link" href={`/app/listings/${listing.id}`}>Open listing detail <Icon name="arrow" size={14} /></Link>}</div></section>
    <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Verification record</div><h3>Attestation details</h3></div><span className="finalized-label"><Icon name="check" size={14} />Finalized</span></div><div className="attestation-grid"><AttestationField label="Requested by" value={assessment.requested_by} /><AttestationField label="Notice identity" value={assessment.notice_id} /><AttestationField label="Listing evidence commitment" value={assessment.listing_evidence_sha256} /><AttestationField label="Recall notice commitment" value={assessment.recall_sha256} /><AttestationField label="Source authority policy" value={assessment.authoritative_source_semantics} /><AttestationField label="Transaction status" value="FINALIZED · successful assessment record" /><AttestationField label="Transaction hash" value={observedTxHash || "Not available in this app session or contract state"} /></div><p className="timestamp-note">A hash is shown only when this app observed the finalized write and saved it locally. The contract's business verdict remains authoritative.</p></section>
    <TechnicalDetails><div className="detail-grid"><span>Verdict</span><code>{assessment.verdict}</code><span>Resulting state</span><code>{assessment.state_after}</code><span>Requester</span><code>{assessment.requested_by}</code><span>Exact notice</span><code>{assessment.recall_url}</code></div></TechnicalDetails>
  </div>;
}

function AttestationField({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><code>{value}</code></div>;
}
