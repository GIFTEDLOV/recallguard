"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../components/Surface";
import { StateBadge, VerdictBadge } from "../../../components/StatusBadge";
import { useContractSnapshot } from "../../../lib/hooks/useContractSnapshot";
import { humanizeError } from "../../../lib/ui";
import type { ListingState } from "../../../lib/types";

const filters: Array<{ value: "ALL" | ListingState; label: string }> = [
  { value: "ALL", label: "All listings" },
  { value: "ACTIVE", label: "Clear" },
  { value: "RECALL_REVIEW", label: "Review required" },
  { value: "BLOCKED", label: "Blocked" },
];

export default function ListingsPage() {
  const { listings, assessments, loading, error, configured } = useContractSnapshot();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | ListingState>("ALL");
  const latestByListing = new Map<string, (typeof assessments)[number]>();
  assessments.forEach((assessment) => latestByListing.set(assessment.listing_id, assessment));
  const filtered = useMemo(() => listings.filter((listing) => {
    const haystack = `${listing.product_name} ${listing.product_id} ${listing.manufacturer} ${listing.model} ${listing.id}`.toLowerCase();
    return (filter === "ALL" || listing.state === filter) && haystack.includes(query.toLowerCase().trim());
  }), [filter, listings, query]);

  return <div className="page-stack">
    <section className="page-intro"><div><div className="eyebrow">Inventory control</div><h2>Listings</h2><p>Every listing is a contract-backed record with a deterministic identity, an evidence source, and an explicit safety state.</p></div><Link className="button button-primary" href="/app/listings/new"><Icon name="plus" size={16} />Register listing</Link></section>
    {!configured && <Notice tone="warning" title="Contract address required">Listings appear here only after the application is connected to a deployed RecallGuard contract.</Notice>}
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice>}
    {configured && <section className="surface table-surface"><div className="table-toolbar"><label className="search-field"><Icon name="search" size={16} /><span className="sr-only">Search listings</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, model, or listing ID" /></label><div className="filter-tabs" role="tablist" aria-label="Filter listings">{filters.map((item) => <button type="button" key={item.value} className={filter === item.value ? "selected" : ""} onClick={() => setFilter(item.value)}>{item.label}<span>{item.value === "ALL" ? listings.length : listings.filter((listing) => listing.state === item.value).length}</span></button>)}</div></div>{loading ? <div className="loading-stack"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div> : filtered.length === 0 ? <EmptyState icon="search" title={listings.length === 0 ? "No listings registered" : "No listings match"} body={listings.length === 0 ? "Register a product to begin tracking recall applicability." : "Try another search term or clear the state filter."} action={listings.length === 0 ? <Link className="button button-primary" href="/app/listings/new"><Icon name="plus" size={16} />Register first listing</Link> : undefined} /> : <div className="listing-table"><div className="listing-table-head"><span>Product</span><span>Safety state</span><span>Latest assessment</span><span>Evidence</span><span /></div>{filtered.map((listing) => { const latest = latestByListing.get(listing.id); return <Link className="listing-table-row" href={`/app/listings/${listing.id}`} key={listing.id}><div className="listing-product"><span className="product-avatar">{listing.product_name.slice(0, 1).toUpperCase()}</span><span><strong>{listing.product_name}</strong><small>{listing.manufacturer} · {listing.model}</small></span></div><div><StateBadge state={listing.state} /></div><div>{latest ? <><VerdictBadge verdict={latest.verdict} /><small className="row-subtext">Finalized attestation</small></> : <span className="muted-label">Not assessed</span>}</div><div className="evidence-source"><Icon name="link" size={14} /><span>{listing.evidence_url ? new URL(listing.evidence_url).host : "Unavailable"}</span></div><Icon name="arrow" size={16} /></Link>; })}</div>}</section>}
    {configured && <TechnicalDetails><div className="detail-grid"><span>Showing</span><code>{filtered.length} of {listings.length} contract listings</code><span>State enum</span><code>ACTIVE · RECALL_REVIEW · BLOCKED</code><span>IDs</span><code>Deterministic SHA-256 listing identity</code></div></TechnicalDetails>}
  </div>;
}
