"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../../components/StatusBadge";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { pendingTransactions } from "../../../../lib/transactions/persistence";
import { hostFromUrl, humanizeError, labelForState, shortHash } from "../../../../lib/ui";

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id || "");
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const listing = listings.find((item) => item.id === id);
  const history = assessments.filter((assessment) => assessment.listing_id === id).reverse();
  const latest = history[0];
  const [observedTxHash, setObservedTxHash] = useState("");

  useEffect(() => {
    if (!latest) return;
    setObservedTxHash(pendingTransactions.confirmed().find((entry) => entry.expected?.assessmentId === latest.id)?.hash || "");
  }, [latest?.id]);

  if (!configured) return <div className="page-stack"><Notice tone="warning" title="Contract address required">This listing can only be opened after the application is connected to a deployed RecallGuard contract.</Notice></div>;
  if (loading) return <div className="page-stack"><div className="skeleton-hero" /><div className="content-grid"><div className="skeleton-panel" /><div className="skeleton-panel" /></div></div>;
  if (error) return <div className="page-stack"><Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice></div>;
  if (!listing) return <div className="page-stack"><div className="back-link"><Link href="/app/listings"><Icon name="arrow" size={14} />Back to listings</Link></div><section className="surface"><EmptyState icon="search" title="Listing not found" body="No contract record matched this listing ID on the configured network." action={<Link className="button button-secondary" href="/app/listings">Return to listings</Link>} /></section></div>;

  return <div className="page-stack">
    <div className="back-link"><Link href="/app/listings"><Icon name="arrow" size={14} />Back to listings</Link></div>
    <section className={`detail-hero detail-${listing.state.toLowerCase()}`}><div className="detail-hero-main"><div className="product-avatar large">{listing.product_name.slice(0, 1).toUpperCase()}</div><div><div className="eyebrow">Tracked marketplace listing</div><h2>{listing.product_name}</h2><p>{listing.manufacturer} · {listing.model}{listing.serial_or_lot ? ` · ${listing.serial_or_lot}` : ""}</p></div></div><div className="detail-hero-side"><StateBadge state={listing.state} /><Link className="button button-primary" href={`/app/listings/${listing.id}/check`}><Icon name="scan" size={16} />Check against a recall</Link></div></section>
    <div className="detail-id-row"><span>Stable listing ID</span><code>{listing.id}</code></div>
    <div className="content-grid detail-grid-layout">
      <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Canonical identity</div><h3>What this record is bound to</h3></div></div><dl className="property-list"><Property label="Marketplace host" value={listing.marketplace_host} /><Property label="External listing ID" value={listing.external_listing_id} /><Property label="Product ID" value={listing.product_id} /><Property label="Manufacturer" value={listing.manufacturer} /><Property label="Model" value={listing.model} /><Property label="Serial / lot" value={listing.serial_or_lot || "Not supplied"} /></dl><div className="source-card"><div className="source-card-icon"><Icon name="link" size={17} /></div><div><span>Marketplace listing</span><strong>{hostFromUrl(listing.listing_url)}</strong><a href={listing.listing_url} target="_blank" rel="noreferrer">Open public URL <Icon name="external" size={13} /></a></div></div><div className="source-card"><div className="source-card-icon"><Icon name="shield" size={17} /></div><div><span>Mutable evidence snapshot</span><strong>{hostFromUrl(listing.evidence_url)}</strong><a href={listing.evidence_url} target="_blank" rel="noreferrer">Open evidence source <Icon name="external" size={13} /></a></div></div></section>
      <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Authoritative state</div><h3>{latest ? "Consensus history exists" : "Awaiting first assessment"}</h3></div></div>{latest ? <div className="latest-outcome"><div className="outcome-badges"><StateBadge state={listing.state} /><VerdictBadge verdict={latest.verdict} /></div><p>{listing.state === "BLOCKED" ? "At least one finalized relevant assessment is affected. A later favorable notice cannot clear this listing." : listing.state === "REVIEW_REQUIRED" ? "At least one finalized relevant assessment is inconclusive. A favorable unrelated notice cannot erase that unresolved result." : "All recorded relevant assessments are not affected."}</p><Link className="text-link" href={`/app/assessments/${latest.id}`}>Open latest attestation <Icon name="arrow" size={14} /></Link></div> : <EmptyState icon="scan" title="Not yet assessed" body="Registration only records the listing. It never produces a cleared or safe state." action={<Link className="button button-primary" href={`/app/listings/${listing.id}/check`}><Icon name="scan" size={15} />Report recall / Challenge listing</Link>} />}</section>
    </div>
    <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Append-only history</div><h3>Assessment history</h3></div><span className="section-count">{history.length} finalized record{history.length === 1 ? "" : "s"}</span></div>{history.length === 0 ? <div className="quiet-empty">No consensus-backed assessment exists yet. Any connected user can start the check.</div> : <div className="history-list">{history.map((assessment) => <Link className="history-row" href={`/app/assessments/${assessment.id}`} key={assessment.id}><div className="history-marker"><Icon name="shield" size={15} /></div><div className="history-main"><strong>{labelForState(assessment.state_after)} after {assessment.verdict.replace("_", " ").toLowerCase()}</strong><span>Requester {shortHash(assessment.requested_by, 8, 6)} · notice {shortHash(assessment.notice_id, 8, 6)} · finalized</span></div><div className="history-right"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /><Icon name="arrow" size={15} /></div></Link>)}</div>}</section>
    <section className="surface challenge-band"><div><div className="eyebrow">Open challenge path</div><h3>See a recall that belongs to this listing?</h3><p>Submit an admissible authoritative notice from any connected wallet. The owner is not a gatekeeper.</p></div><Link className="button button-primary" href={`/app/listings/${listing.id}/check`}><Icon name="scan" size={16} />Report recall / Challenge listing</Link></section>
    <TechnicalDetails><div className="detail-grid"><span>Owner</span><code>{listing.owner}</code><span>Consensus exists</span><code>{history.length > 0 ? "Yes" : "No — not yet assessed"}</code><span>Evidence SHA-256</span><code>{listing.evidence_sha256}</code><span>Identity model</span><code>{listing.identity_version}</code><span>Latest transaction status</span><code>{latest ? "FINALIZED · successful assessment record" : "No assessment transaction"}</code><span>Latest transaction hash</span><code>{observedTxHash || "Not available in this app session or contract state"}</code></div></TechnicalDetails>
  </div>;
}

function Property({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
