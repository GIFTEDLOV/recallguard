"use client";

import Link from "next/link";
import { Icon } from "../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../components/Surface";
import { StateBadge, VerdictBadge } from "../../components/StatusBadge";
import { useContractSnapshot } from "../../lib/hooks/useContractSnapshot";
import { useWallet } from "../../lib/hooks/useWallet";
import { humanizeError, shortHash } from "../../lib/ui";

export default function DashboardPage() {
  const { listings, assessments, info, loading, error, configured, refresh } = useContractSnapshot();
  const { wallet } = useWallet();
  const byListing = new Map(listings.map((listing) => [listing.id, listing]));
  const recent = [...assessments].reverse().slice(0, 5);
  const unassessed = listings.filter((listing) => listing.state === "UNASSESSED").length;
  const clear = listings.filter((listing) => listing.state === "CLEARED").length;
  const review = listings.filter((listing) => listing.state === "REVIEW_REQUIRED").length;
  const blocked = listings.filter((listing) => listing.state === "BLOCKED").length;

  return <div className="page-stack">
    <section className="page-intro"><div><div className="eyebrow">Safety operations</div><h2>Know what should no longer be sold.</h2><p>Track product listings, run evidence-bound recall checks, and keep the resulting safety state tied to a recorded GenLayer attestation.</p></div><div className="intro-actions"><button className="button button-secondary" onClick={() => void refresh()} disabled={loading}><Icon name="refresh" size={15} />{loading ? "Refreshing" : "Refresh state"}</button><Link className="button button-primary" href="/app/listings/new"><Icon name="plus" size={16} />Register listing</Link></div></section>

    {!configured && <Notice tone="warning" title="Connect this workspace to RecallGuard">Set <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> in the frontend environment to read live contract state. The application will never invent records while the contract is unconfigured.</Notice>}
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice>}

    {configured && !loading && !error && <>
      <section className="metric-grid" aria-label="Contract-backed listing metrics">
        <Metric label="Tracked" value={listings.length} detail="Registered listings" tone="neutral" icon="box" />
        <Metric label="Not yet assessed" value={unassessed} detail="Needs first check" tone="unassessed" icon="scan" />
        <Metric label="Review required" value={review} detail="Needs a decision" tone="review" icon="scan" />
        <Metric label="Blocked" value={blocked} detail="Do not sell or ship" tone="blocked" icon="shield" />
        <Metric label="Cleared" value={clear} detail="Cleared by consensus" tone="clear" icon="check" />
      </section>

      {listings.length === 0 ? <section className="surface onboarding-surface"><EmptyState icon="box" eyebrow="Your workspace is ready" title="Start with one tracked listing" body="Register a product and its public evidence source. RecallGuard will keep the identity and evidence commitment on-chain before any recall assessment can change its state." action={<Link className="button button-primary" href="/app/listings/new"><Icon name="plus" size={16} />Register first listing</Link>} /><div className="onboarding-steps"><Step number="01" title="Register a product" body="Commit the product identity and evidence reference." /><Step number="02" title="Attach an official recall" body="Use a configured authority and an exact source hash." /><Step number="03" title="Confirm the state" body="Read the recorded attestation and resulting state." /></div></section> : <div className="content-grid dashboard-grid">
        <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Contract records</div><h3>Recent assessments</h3></div><Link className="text-link" href="/app/attestations">View all <Icon name="arrow" size={14} /></Link></div>{recent.length === 0 ? <EmptyState icon="scan" title="No assessments yet" body="Your tracked listings are waiting for an authoritative recall check." action={<Link className="button button-secondary" href="/app/checks"><Icon name="scan" size={15} />Start a recall check</Link>} /> : <div className="assessment-list">{recent.map((assessment) => { const listing = byListing.get(assessment.listing_id); return <Link className="assessment-row" href={`/app/checks/${assessment.id}`} key={assessment.id}><div className="assessment-icon"><Icon name="scan" size={16} /></div><div className="assessment-main"><strong>{listing?.product_name || "Listing record"}</strong><span>{listing?.model || shortHash(assessment.listing_id)} <span className="muted-separator">·</span> Recorded on contract</span></div><div className="assessment-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /><Icon name="arrow" size={15} /></div></Link>; })}</div>}</section>
        <section className="surface section-card"><div className="section-heading"><div><div className="eyebrow">Attention queue</div><h3>Listings needing action</h3></div><Link className="text-link" href="/app/listings">Open listings <Icon name="arrow" size={14} /></Link></div>{review + unassessed === 0 ? <EmptyState icon="check" title="No open safety work" body="Every tracked listing has an authoritative state." /> : <div className="attention-list">{listings.filter((listing) => listing.state === "UNASSESSED" || listing.state === "REVIEW_REQUIRED").slice(0, 5).map((listing) => <Link href={`/app/listings/${listing.id}`} className="attention-row" key={listing.id}><div><strong>{listing.product_name}</strong><span>{listing.state === "UNASSESSED" ? "Not yet assessed" : "Review required"} <span className="muted-separator">·</span> {listing.model}</span></div><StateBadge state={listing.state} /></Link>)}</div>}</section>
      </div>}

      <section className="surface evidence-band"><div className="evidence-copy"><div className="eyebrow">Evidence policy</div><h3>Consensus interprets evidence. It does not authenticate it.</h3><p>RecallGuard separates source policy, integrity, availability, semantic output, and consensus. A missing source or malformed evaluator result fails closed and does not become a safe state.</p><Link className="text-link" href="/#how-it-works">Read the trust model <Icon name="arrow" size={14} /></Link></div><div className="evidence-facts"><Fact label="Authorized sources" value={info?.authorized_recall_domains?.length ? `${info.authorized_recall_domains.length} configured` : "Configured on contract"} /><Fact label="Evidence limit" value={info ? `${Math.round(info.max_evidence_bytes / 1000)} KB` : "Contract-defined"} /><Fact label="Source semantics" value="Mutable authoritative source" /></div></section>
    </>}

    {wallet && <TechnicalDetails><div className="detail-grid"><span>Connected wallet</span><code>{wallet}</code><span>Contract interface</span><code>RecallGuard v2</code><span>States</span><code>UNASSESSED · CLEARED · REVIEW_REQUIRED · BLOCKED</code></div></TechnicalDetails>}
  </div>;
}

function Metric({ label, value, detail, tone, icon }: { label: string; value: number; detail: string; tone: string; icon: "box" | "scan" | "shield" | "check" }) {
  return <div className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><Icon name={icon} size={17} /></div><strong>{value}</strong><small>{detail}</small></div>;
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="onboarding-step"><span>{number}</span><div><strong>{title}</strong><p>{body}</p></div></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="evidence-fact"><span>{label}</span><strong>{value}</strong></div>;
}
