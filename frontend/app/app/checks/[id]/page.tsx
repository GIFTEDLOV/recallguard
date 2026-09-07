"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "../../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../../components/StatusBadge";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { hostFromUrl, humanizeError, shortHash } from "../../../../lib/ui";

export default function CheckDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id || "");
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const assessment = assessments.find((item) => item.id === id);
  const listing = assessment ? listings.find((item) => item.id === assessment.listing_id) : undefined;

  if (!configured) return <div className="page-stack"><Notice tone="warning" title="Contract address required">Assessment records are read directly from RecallGuard after deployment.</Notice></div>;
  if (loading) return <div className="page-stack"><div className="skeleton-hero" /><div className="skeleton-panel" /></div>;
  if (error) return <div className="page-stack"><Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice></div>;
  if (!assessment) return <div className="page-stack"><div className="back-link"><Link href="/app/checks"><Icon name="arrow" size={14} />Back to checks</Link></div><section className="surface"><EmptyState icon="search" title="Assessment not found" body="No finalized contract record matched this assessment ID." action={<Link className="button button-secondary" href="/app/checks">Return to checks</Link>} /></section></div>;

  return <div className="page-stack">
    <div className="back-link"><Link href="/app/checks"><Icon name="arrow" size={14} />Back to checks</Link></div>
    <section className={`assessment-hero verdict-${assessment.verdict.toLowerCase()}`}><div><div className="eyebrow">Finalized assessment</div><h2>{assessment.verdict === "AFFECTED" ? "Affected scope confirmed" : assessment.verdict === "INCONCLUSIVE" ? "Review required" : "No affected scope found"}</h2><p>{listing?.product_name || "Tracked listing"} <span className="muted-separator">·</span> {listing?.model || shortHash(assessment.listing_id)}</p></div><div className="assessment-hero-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div></section>
    <div className="detail-id-row"><span>Assessment ID</span><code>{assessment.id}</code></div>
    <section className="content-grid detail-grid-layout"><div className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Decision record</div><h3>What RecallGuard stored</h3></div></div><div className="decision-statement"><div className="decision-check"><Icon name="shield" size={24} /></div><div><strong>{assessment.verdict === "AFFECTED" ? "This listing is within the affected scope." : assessment.verdict === "INCONCLUSIVE" ? "The evidence was not sufficient to establish applicability." : "This listing was not found within the affected scope."}</strong><p>State consequence: <b>{assessment.state_after}</b>. The frontend displays this finalized result and does not derive it.</p></div></div><div className="source-card"><div className="source-card-icon"><Icon name="link" size={17} /></div><div><span>Official recall source</span><strong>{hostFromUrl(assessment.recall_url)}</strong><a href={assessment.recall_url} target="_blank" rel="noreferrer">Open source URL <Icon name="external" size={13} /></a></div></div></div><div className="surface section-card"><div className="section-heading"><div><div className="eyebrow">State consequence</div><h3>Listing status</h3></div></div><div className="state-outcome"><StateBadge state={assessment.state_after} /><p>{assessment.state_after === "BLOCKED" ? "This listing is blocked for V1 and cannot be assessed again through the contract." : assessment.state_after === "RECALL_REVIEW" ? "The listing remains visible but requires human review before it can be treated as clear." : "The listing is active after a successful, consensus-backed assessment."}</p></div>{listing && <Link className="text-link" href={`/app/listings/${listing.id}`}>Open listing detail <Icon name="arrow" size={14} /></Link>}</div></section>
    <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Verification record</div><h3>Attestation details</h3></div><span className="finalized-label"><Icon name="check" size={14} />Finalized</span></div><div className="attestation-grid"><AttestationField label="Requested by" value={assessment.requested_by} /><AttestationField label="Listing evidence commitment" value={assessment.listing_evidence_sha256} /><AttestationField label="Recall notice commitment" value={assessment.recall_sha256} /><AttestationField label="Source semantics" value={assessment.authoritative_source_semantics} /></div><p className="timestamp-note">The contract does not supply a block timestamp in this V1 record. Finalized status above is read from the stored assessment.</p></section>
    <TechnicalDetails><div className="detail-grid"><span>Verdict enum</span><code>{assessment.verdict}</code><span>State enum</span><code>{assessment.state_after}</code><span>Assessment status</span><code>{assessment.status}</code><span>Recall URL</span><code>{assessment.recall_url}</code></div></TechnicalDetails>
  </div>;
}

function AttestationField({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><code>{value}</code></div>;
}
