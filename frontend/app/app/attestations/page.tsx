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
    <section className="page-intro"><div><div className="eyebrow">Proof directory</div><h2>Attestations</h2><p>Finalized assessment records returned by RecallGuard. Technical evidence is available without making it the primary workflow.</p></div><Link className="button button-secondary" href="/app/checks"><Icon name="scan" size={16} />Run a check</Link></section>
    {!configured && <Notice tone="warning" title="Contract address required">Attestations are never fabricated. Connect this workspace to a deployed contract to load finalized records.</Notice>}
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice>}
    {configured && (loading ? <div className="loading-stack"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div> : assessments.length === 0 ? <section className="surface"><EmptyState icon="shield" eyebrow="No proofs yet" title="Your attestation directory is empty" body="A finalized assessment produces the first record here. Start with a tracked listing and an official recall source." action={<Link className="button button-primary" href="/app/checks"><Icon name="scan" size={16} />Start a recall check</Link>} /></section> : <section className="attestation-list">{[...assessments].reverse().map((assessment) => { const listing = listingMap.get(assessment.listing_id); return <Link href={`/app/checks/${assessment.id}`} className="surface attestation-card" key={assessment.id}><div className="attestation-card-top"><div className="attestation-symbol"><Icon name="shield" size={18} /></div><div><div className="eyebrow">Finalized attestation</div><h3>{listing?.product_name || "Listing record"}</h3><p>{listing?.manufacturer || "Unknown manufacturer"} <span className="muted-separator">·</span> {listing?.model || shortHash(assessment.listing_id)}</p></div><Icon name="arrow" size={17} /></div><div className="attestation-card-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div><div className="attestation-card-meta"><span>Assessment <code>{shortHash(assessment.id, 12, 8)}</code></span><span>Evidence <code>{shortHash(assessment.recall_sha256, 10, 8)}</code></span><span className="meta-source">{assessment.authoritative_source_semantics.replaceAll("_", " ").toLowerCase()}</span></div></Link>; })}</section>)}
    {configured && <TechnicalDetails><div className="detail-grid"><span>Records shown</span><code>{assessments.length} finalized contract assessment{assessments.length === 1 ? "" : "s"}</code><span>Timestamp</span><code>Not supplied by the V1 assessment record</code><span>Authoritative fields</span><code>verdict · state_after · evidence commitments</code></div></TechnicalDetails>}
  </div>;
}
