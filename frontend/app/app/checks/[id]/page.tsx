"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../../components/StatusBadge";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { pendingTransactions } from "../../../../lib/transactions/persistence";
import { humanizeError, shortHash, stateExplanation } from "../../../../lib/ui";

const cpscUrl = (recallIdentifier: string) => `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=${encodeURIComponent(recallIdentifier)}`;

export default function CheckDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id || "");
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const assessment = assessments.find((item) => item.id === id);
  const listing = assessment ? listings.find((item) => item.id === assessment.listing_id) : undefined;
  const [observedTxHash, setObservedTxHash] = useState("");

  useEffect(() => {
    if (!assessment) return;
    const match = pendingTransactions.confirmed().find((entry) => entry.expected?.listingId === assessment.listing_id && entry.expected.recallIdentifier === assessment.recall_identifier);
    setObservedTxHash(match?.hash || "");
  }, [assessment?.id, assessment?.listing_id, assessment?.recall_identifier]);

  if (!configured) return <div className="page-stack"><Notice tone="warning" title="Contract address required">Assessment records are read directly from RecallGuard V2 after deployment.</Notice></div>;
  if (loading) return <div className="page-stack"><div className="skeleton-hero" /><div className="skeleton-panel" /></div>;
  if (error) return <div className="page-stack"><Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice></div>;
  if (!assessment) return <div className="page-stack"><div className="back-link"><Link href="/app/assessments"><Icon name="arrow" size={14} />Back to assessments</Link></div><section className="surface"><EmptyState icon="search" title="Assessment not found" body="No recorded contract assessment matched this assessment ID." action={<Link className="button button-secondary" href="/app/assessments">Return to assessments</Link>} /></section></div>;

  const title = assessment.verdict === "AFFECTED" ? "Affected scope confirmed" : assessment.verdict === "INCONCLUSIVE" ? "Applicability remains uncertain" : "No affected scope found";
  return <div className="page-stack">
    <div className="back-link"><Link href="/app/assessments"><Icon name="arrow" size={14} />Back to assessments</Link></div>
    <section className={`assessment-hero verdict-${assessment.verdict.toLowerCase()}`}><div><div className="eyebrow">Recorded assessment attestation</div><h2>{title}</h2><p>{listing?.product_name || "Tracked listing"} · {listing?.model || shortHash(assessment.listing_id)}</p></div><div className="assessment-hero-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div></section>
    <div className="detail-id-row"><span>Assessment ID</span><code>{assessment.id}</code></div>
    <section className="content-grid detail-grid-layout"><div className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Decision record</div><h3>What RecallGuard stored</h3></div></div><div className="decision-statement"><div className="decision-check"><Icon name="shield" size={24} /></div><div><strong>{assessment.verdict === "AFFECTED" ? "The registered facts are within the affected CPSC scope." : assessment.verdict === "INCONCLUSIVE" ? "The admissible facts did not resolve applicability." : "The registered facts are outside the affected CPSC scope."}</strong><p>Resulting state: <b>{assessment.state_after}</b>. The frontend reads this authoritative contract value; it does not derive or soften it.</p></div></div><div className="source-card"><div className="source-card-icon"><Icon name="link" size={17} /></div><div><span>Recall authority</span><strong>{assessment.authoritative_source}</strong><a href={cpscUrl(assessment.recall_identifier)} target="_blank" rel="noreferrer">Open CPSC API record <Icon name="external" size={13} /></a><small>Recall number {assessment.recall_identifier}</small></div></div></div><div className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Aggregate consequence</div><h3>{assessment.state_after}</h3></div></div><div className="state-outcome"><StateBadge state={assessment.state_after} /><p>{stateExplanation(assessment.state_after)}</p></div>{listing && <Link className="text-link" href={`/app/listings/${listing.id}`}>Open listing detail <Icon name="arrow" size={14} /></Link>}</div></section>
    <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Verifiable assessment record</div><h3>Attestation details</h3></div><span className="finalized-label"><Icon name="check" size={14} />{observedTxHash ? "Finalized + verified" : "Recorded"}</span></div><div className="attestation-grid"><AttestationField label="Requested by" value={assessment.requested_by} /><AttestationField label="Logical notice ID" value={assessment.notice_id} /><AttestationField label="CPSC recall number" value={assessment.recall_identifier} /><AttestationField label="Recall source" value={assessment.recall_source} /><AttestationField label="Evidence snapshot ID" value={assessment.snapshot_id} /><AttestationField label="Canonical snapshot SHA-256" value={assessment.snapshot_sha256} /><AttestationField label="Source policy" value={assessment.source_policy_version} /><AttestationField label="Contract record status" value={assessment.status} /><AttestationField label="Transaction lifecycle" value={observedTxHash ? "FINALIZED + FINISHED_WITH_RETURN" : "Not observed in this app session"} /><AttestationField label="Transaction hash" value={observedTxHash || "Not available in this app session"} /></div><p className="timestamp-note">ADJUDICATED is the contract's record status. Protocol finality is shown only when this app has reconciled the same GenLayer transaction ID and verified FINISHED_WITH_RETURN.</p></section>
    <TechnicalDetails><div className="detail-grid"><span>Verdict</span><code>{assessment.verdict}</code><span>Resulting state</span><code>{assessment.state_after}</code><span>Requester</span><code>{assessment.requested_by}</code><span>Logical notice</span><code>{assessment.notice_id}</code><span>Snapshot</span><code>{assessment.snapshot_id}</code></div></TechnicalDetails>
  </div>;
}

function AttestationField({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><code>{value}</code></div>;
}
