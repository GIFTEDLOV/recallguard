"use client";

import Link from "next/link";
import { Icon } from "../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../components/StatusBadge";
import { useContractSnapshot } from "../../../lib/hooks/useContractSnapshot";
import { humanizeError, shortHash } from "../../../lib/ui";

export default function AttestationsPage() {
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

  return <div className="page-stack">
    <section className="page-intro"><div><div className="eyebrow">Proof directory</div><h2>Attestations</h2><p>Recorded, append-only assessment records returned by RecallGuard V2. Every requester, logical notice, evidence snapshot, verdict, and state consequence remains visible.</p></div><Link className="button button-secondary" href="/app/checks"><Icon name="scan" size={16} />Check a listing</Link></section>
    {!configured && <Notice tone="warning" title="Contract address required">Attestations are never fabricated. Connect this workspace to a deployed RecallGuard V2 contract to load recorded assessment records.</Notice>}
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice>}
    {configured && (loading ? <div className="loading-stack"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div> : assessments.length === 0 ? <section className="surface"><EmptyState icon="shield" eyebrow="No records yet" title="Your attestation directory is empty" body="A successful permissionless check produces the first contract record here." action={<Link className="button button-primary" href="/app/checks"><Icon name="scan" size={16} />Start a recall check</Link>} /></section> : <section className="attestation-list">{[...assessments].reverse().map((assessment) => { const listing = listingMap.get(assessment.listing_id); return <Link href={`/app/assessments/${assessment.id}`} className="surface attestation-card" key={assessment.id}><div className="attestation-card-top"><div className="attestation-symbol"><Icon name="shield" size={18} /></div><div><div className="eyebrow">Recorded attestation</div><h3>{listing?.product_name || "Listing record"}</h3><p>{listing?.manufacturer || "Unknown manufacturer"} · {listing?.model || shortHash(assessment.listing_id)}</p></div><Icon name="arrow" size={17} /></div><div className="attestation-card-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div><div className="attestation-card-meta"><span>Assessment <code>{shortHash(assessment.id, 12, 8)}</code></span><span>Notice <code>{shortHash(assessment.notice_id, 10, 8)}</code></span><span>Snapshot <code>{shortHash(assessment.snapshot_id, 10, 8)}</code></span><span>Requester <code>{shortHash(assessment.requested_by, 8, 6)}</code></span></div></Link>; })}</section>)}
    {configured && <TechnicalDetails><div className="detail-grid"><span>Records shown</span><code>{assessments.length} recorded assessment{assessments.length === 1 ? "" : "s"}</code><span>Logical notice identity</span><code>Authority host + issued notice reference</code><span>Evidence snapshot</span><code>Recall SHA-256 binds fetched bytes; it does not redefine the notice</code><span>Authoritative fields</span><code>requester · verdict · aggregate state · evidence commitments</code></div></TechnicalDetails>}
  </div>;
}
