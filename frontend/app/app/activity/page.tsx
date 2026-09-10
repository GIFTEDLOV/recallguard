"use client";

import Link from "next/link";
import { Icon } from "../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../components/StatusBadge";
import { useContractSnapshot } from "../../../lib/hooks/useContractSnapshot";
import { humanizeError } from "../../../lib/ui";

export default function ActivityPage() {
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

  return <div className="page-stack">
    <section className="page-intro"><div><div className="eyebrow">Contract ledger</div><h2>Activity</h2><p>Append order for listing registrations and finalized permissionless assessments. V2 does not invent timestamps that the contract does not store.</p></div></section>
    {!configured && <Notice tone="warning" title="Contract address required">Activity is populated only from live RecallGuard V2 reads.</Notice>}
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice>}
    {configured && (loading ? <div className="surface"><div className="loading-stack"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div></div> : listings.length === 0 && assessments.length === 0 ? <section className="surface"><EmptyState icon="activity" title="No activity yet" body="Registered listings and finalized checks will appear here." action={<Link className="button button-primary" href="/app/listings/new"><Icon name="plus" size={16} />Register a listing</Link>} /></section> : <section className="surface activity-surface"><div className="activity-list">{[...assessments].reverse().map((assessment) => { const listing = listingMap.get(assessment.listing_id); return <Link className="activity-row" href={`/app/assessments/${assessment.id}`} key={`assessment-${assessment.id}`}><div className="activity-marker assessment"><Icon name="shield" size={15} /></div><div className="activity-body"><div className="activity-line"><strong>Recall check finalized</strong><span>Contract record</span></div><p>{listing?.product_name || "Listing record"} · {assessment.verdict.replaceAll("_", " ")}</p><div className="activity-tags"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div></div><Icon name="arrow" size={15} /></Link>; })}{[...listings].reverse().map((listing) => <Link className="activity-row" href={`/app/listings/${listing.id}`} key={`listing-${listing.id}`}><div className="activity-marker listing"><Icon name="box" size={15} /></div><div className="activity-body"><div className="activity-line"><strong>Listing registered</strong><span>Contract record</span></div><p>{listing.product_name} · {listing.marketplace_host} · {listing.external_listing_id}</p><div className="activity-tags"><StateBadge state={listing.state} /></div></div><Icon name="arrow" size={15} /></Link>)}</div></section>)}
    {configured && <TechnicalDetails><div className="detail-grid"><span>Ordering</span><code>Contract append order</code><span>Timestamps</span><code>Not available in V2 storage</code><span>Source</span><code>RecallGuard public views</code></div></TechnicalDetails>}
  </div>;
}
