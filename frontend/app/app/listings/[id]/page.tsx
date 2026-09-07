"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "../../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../../components/StatusBadge";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { hostFromUrl, humanizeError, labelForState, shortHash } from "../../../../lib/ui";

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id || "");
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const listing = listings.find((item) => item.id === id);
  const history = assessments.filter((assessment) => assessment.listing_id === id).reverse();
  const latest = history[0];

  if (!configured) return <div className="page-stack"><Notice tone="warning" title="Contract address required">This listing can only be opened after the frontend is connected to a deployed RecallGuard contract.</Notice></div>;
  if (loading) return <div className="page-stack"><div className="skeleton-hero" /><div className="content-grid"><div className="skeleton-panel" /><div className="skeleton-panel" /></div></div>;
  if (error) return <div className="page-stack"><Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice></div>;
  if (!listing) return <div className="page-stack"><div className="back-link"><Link href="/app/listings"><Icon name="arrow" size={14} />Back to listings</Link></div><section className="surface"><EmptyState icon="search" title="Listing not found" body="No contract record matched this listing ID. It may be invalid or not available on the configured network." action={<Link className="button button-secondary" href="/app/listings">Return to listings</Link>} /></section></div>;

  return <div className="page-stack">
    <div className="back-link"><Link href="/app/listings"><Icon name="arrow" size={14} />Back to listings</Link></div>
    <section className={`detail-hero detail-${listing.state.toLowerCase()}`}><div className="detail-hero-main"><div className="product-avatar large">{listing.product_name.slice(0, 1).toUpperCase()}</div><div><div className="eyebrow">Tracked listing</div><h2>{listing.product_name}</h2><p>{listing.manufacturer} <span className="muted-separator">·</span> {listing.model} <span className="muted-separator">·</span> {listing.serial_or_lot}</p></div></div><div className="detail-hero-side"><StateBadge state={listing.state} /><Link className="button button-primary" href={`/app/checks?listingId=${encodeURIComponent(listing.id)}`}><Icon name="scan" size={16} />Run recall check</Link></div></section>
    <div className="detail-id-row"><span>Listing ID</span><code>{listing.id}</code></div>
    <div className="content-grid detail-grid-layout">
      <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Product record</div><h3>Identity and source</h3></div></div><dl className="property-list"><Property label="Product ID" value={listing.product_id} /><Property label="Manufacturer" value={listing.manufacturer} /><Property label="Model" value={listing.model} /><Property label="Serial / lot" value={listing.serial_or_lot} /></dl><div className="source-card"><div className="source-card-icon"><Icon name="link" size={17} /></div><div><span>Product listing</span><strong>{hostFromUrl(listing.listing_url)}</strong><a href={listing.listing_url} target="_blank" rel="noreferrer">Open public URL <Icon name="external" size={13} /></a></div></div><div className="source-card"><div className="source-card-icon"><Icon name="shield" size={17} /></div><div><span>Evidence source</span><strong>{hostFromUrl(listing.evidence_url)}</strong><a href={listing.evidence_url} target="_blank" rel="noreferrer">Open evidence source <Icon name="external" size={13} /></a></div></div></section>
      <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Latest outcome</div><h3>{latest ? "Assessment result" : "Awaiting first assessment"}</h3></div></div>{latest ? <div className="latest-outcome"><div className="outcome-badges"><VerdictBadge verdict={latest.verdict} /><StateBadge state={latest.state_after} /></div><p>{latest.verdict === "AFFECTED" ? "The contract found this listing within the affected scope. It is blocked." : latest.verdict === "INCONCLUSIVE" ? "The evidence did not establish a reliable match or exclusion. Review is required." : "The contract did not find this listing within the affected scope under the assessed evidence."}</p><Link className="text-link" href={`/app/checks/${latest.id}`}>Open assessment record <Icon name="arrow" size={14} /></Link></div> : <EmptyState icon="scan" title="No recall decision recorded" body="Start a check using an official recall URL and its exact source commitment. The listing remains ACTIVE until an assessment changes it." action={<Link className="button button-primary" href={`/app/checks?listingId=${encodeURIComponent(listing.id)}`}><Icon name="scan" size={15} />Start first check</Link>} />}</section>
    </div>
    <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Contract history</div><h3>Assessment history</h3></div><span className="section-count">{history.length} record{history.length === 1 ? "" : "s"}</span></div>{history.length === 0 ? <div className="quiet-empty">No finalized assessments are stored for this listing.</div> : <div className="history-list">{history.map((assessment) => <Link className="history-row" href={`/app/checks/${assessment.id}`} key={assessment.id}><div className="history-marker"><Icon name="shield" size={15} /></div><div className="history-main"><strong>{labelForState(assessment.state_after)} after {assessment.verdict.toLowerCase().replace("_", " ")}</strong><span>Finalized attestation <span className="muted-separator">·</span> timestamp not supplied by contract</span></div><div className="history-right"><VerdictBadge verdict={assessment.verdict} /><Icon name="arrow" size={15} /></div></Link>)}</div>}</section>
    <TechnicalDetails><div className="detail-grid"><span>Listing owner</span><code>{listing.owner}</code><span>Evidence SHA-256</span><code>{listing.evidence_sha256}</code><span>Source semantics</span><code>Mutable authoritative source</code><span>Contract enum</span><code>{listing.state}</code></div></TechnicalDetails>
  </div>;
}

function Property({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
