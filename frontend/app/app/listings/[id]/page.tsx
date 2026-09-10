"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../../components/StatusBadge";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { pendingTransactions } from "../../../../lib/transactions/persistence";
import { hostFromUrl, humanizeError, labelForState, shortHash, stateExplanation } from "../../../../lib/ui";

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
    const match = pendingTransactions.confirmed().find((entry) => entry.expected?.listingId === id && entry.expected.recallIdentifier === latest.recall_identifier);
    setObservedTxHash(match?.hash || "");
  }, [id, latest?.id, latest?.recall_identifier]);

  if (!configured) return <div className="page-stack"><Notice tone="warning" title="Contract address required">This listing is read from a deployed RecallGuard V2 contract.</Notice></div>;
  if (loading) return <div className="page-stack"><div className="skeleton-hero" /><div className="content-grid"><div className="skeleton-panel" /><div className="skeleton-panel" /></div></div>;
  if (error) return <div className="page-stack"><Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice></div>;
  if (!listing) return <div className="page-stack"><div className="back-link"><Link href="/app/listings"><Icon name="arrow" size={14} />Back to listings</Link></div><section className="surface"><EmptyState icon="search" title="Listing not found" body="No contract record matched this stable listing ID on the configured network." action={<Link className="button button-secondary" href="/app/listings">Return to listings</Link>} /></section></div>;

  return <div className="page-stack">
    <div className="back-link"><Link href="/app/listings"><Icon name="arrow" size={14} />Back to listings</Link></div>
    <section className={`detail-hero detail-${listing.state.toLowerCase()}`}><div className="detail-hero-main"><div className="product-avatar large">{listing.product_name.slice(0, 1).toUpperCase()}</div><div><div className="eyebrow">RecallGuard listing record</div><h2>{listing.product_name}</h2><p>{listing.manufacturer} · {listing.model}{listing.serial_or_lot ? ` · ${listing.serial_or_lot}` : ""}</p></div></div><div className="detail-hero-side"><StateBadge state={listing.state} /><Link className="button button-primary" href={`/app/listings/${listing.id}/check`}><Icon name="scan" size={16} />Check against a recall</Link></div></section>
    <div className="detail-id-row"><span>Stable listing ID</span><code>{listing.id}</code></div>
    <div className="content-grid detail-grid-layout">
      <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Registered facts</div><h3>What this record contains</h3></div></div><dl className="property-list"><Property label="Identity version" value={listing.identity_version} /><Property label="Marketplace host" value={listing.marketplace_host} /><Property label="External listing ID" value={listing.external_listing_id} /><Property label="Product ID" value={listing.product_id} /><Property label="Manufacturer" value={listing.manufacturer} /><Property label="Model" value={listing.model} /><Property label="Serial / lot" value={listing.serial_or_lot || "Not supplied"} /><Property label="Registered by" value={listing.owner} /></dl><p className="field-help">The stable identity is the marketplace namespace plus external listing ID. Product descriptions, URL formatting, and later evidence snapshots cannot create a second record. These are registered facts, not authenticated marketplace claims.</p><div className="source-card"><div className="source-card-icon"><Icon name="link" size={17} /></div><div><span>Informational marketplace URL</span><strong>{hostFromUrl(listing.listing_url)}</strong><a href={listing.listing_url} target="_blank" rel="noreferrer">Open navigation link <Icon name="external" size={13} /></a></div></div></section>
      <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Authoritative state</div><h3>{labelForState(listing.state)}</h3></div></div><div className="latest-outcome"><div className="outcome-badges"><StateBadge state={listing.state} />{latest && <VerdictBadge verdict={latest.verdict} />}</div><p>{stateExplanation(listing.state)}</p>{listing.state === "UNASSESSED" && <p className="field-help">No consensus assessment exists. This record is not described as safe, clear, verified, or approved.</p>}{latest && <Link className="text-link" href={`/app/assessments/${latest.id}`}>Open latest assessment <Icon name="arrow" size={14} /></Link>}</div></section>
    </div>
    <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Append-only history</div><h3>Complete assessment history</h3></div><span className="section-count">{history.length} recorded assessment{history.length === 1 ? "" : "s"}</span></div>{history.length === 0 ? <div className="quiet-empty">No successful consensus-backed assessment exists yet. Any connected wallet can start the check.</div> : <div className="history-list">{history.map((assessment) => <Link className="history-row" href={`/app/assessments/${assessment.id}`} key={assessment.id}><div className="history-marker"><Icon name="shield" size={15} /></div><div className="history-main"><strong>{labelForState(assessment.state_after)} after {assessment.verdict.replace("_", " ").toLowerCase()}</strong><span>Requester {shortHash(assessment.requested_by, 8, 6)} · {assessment.authoritative_source} · recall {assessment.recall_identifier} · notice {shortHash(assessment.notice_id, 8, 6)} · snapshot {shortHash(assessment.snapshot_id, 8, 6)}</span></div><div className="history-right"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /><Icon name="arrow" size={15} /></div></Link>)}</div>}</section>
    <section className="surface challenge-band"><div><div className="eyebrow">Open challenge path</div><h3>See a CPSC recall that may apply?</h3><p>Any connected wallet can submit a bounded CPSC recall number. The owner is not a gatekeeper and cannot erase the resulting history.</p></div><Link className="button button-primary" href={`/app/listings/${listing.id}/check`}><Icon name="scan" size={16} />Report recall / Challenge listing</Link></section>
    <TechnicalDetails><div className="detail-grid"><span>Current authoritative state</span><code>{listing.state}</code><span>Consensus assessment exists</span><code>{history.length > 0 ? "Yes" : "No - not yet assessed"}</code><span>Latest contract record status</span><code>{latest?.status || "No assessment record"}</code><span>Latest transaction lifecycle</span><code>{observedTxHash ? "Finalized + execution verified" : latest ? "Not observed in this app session" : "No assessment transaction"}</code><span>Latest transaction hash</span><code>{observedTxHash || "Not available in this app session"}</code></div></TechnicalDetails>
  </div>;
}

function Property({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
