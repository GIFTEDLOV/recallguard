"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../../../components/Icon";
import { Notice, TechnicalDetails } from "../../../../components/Surface";
import { TransactionProgress } from "../../../../components/TransactionProgress";
import { PendingTransactionError, type TransactionProgress as TxProgress } from "../../../../lib/contracts/RecallGuard";
import { sha256Hex } from "../../../../lib/canonical";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { useWallet } from "../../../../lib/hooks/useWallet";
import { humanizeError } from "../../../../lib/ui";

const initial = { marketplaceHost: "", externalListingId: "", productId: "", productName: "", manufacturer: "", model: "", serialOrLot: "", listingUrl: "", evidenceUrl: "", evidenceSha256: "" };

export default function NewListingPage() {
  const router = useRouter();
  const { contract, info, configured } = useContractSnapshot();
  const { wallet, isCorrectNetwork, switchNetwork, connecting } = useWallet();
  const [form, setForm] = useState(initial);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [hashing, setHashing] = useState(false);
  const [hashMessage, setHashMessage] = useState("");

  function update(field: keyof typeof initial, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function hashEvidence() {
    if (!form.evidenceUrl) { setHashMessage("Add the public evidence URL first."); return; }
    setHashing(true); setHashMessage("");
    try {
      const response = await fetch(form.evidenceUrl);
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      update("evidenceSha256", await sha256Hex(await response.text()));
      setHashMessage("Commitment calculated from the response available to this browser.");
    } catch (nextError) {
      setHashMessage(`Could not calculate automatically: ${String(nextError).replace(/^Error:\s*/i, "")}`);
    } finally { setHashing(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!configured || !contract) { setError(new Error("Contract address is not configured")); return; }
    if (!wallet) { setError(new Error("Connect a wallet before registering a listing")); return; }
    if (!isCorrectNetwork) { setError(new Error("Switch to the configured GenLayer network before submitting")); return; }
    setProgress({ stage: "PRECONDITION_READ", detail: "Checking deterministic listing identity" });
    try {
      const result = await contract.registerListing({ ...form, walletAddress: wallet }, setProgress);
      router.push(`/app/listings/${result.listingId}`);
    } catch (nextError) {
      setError(nextError);
      if (!(nextError instanceof PendingTransactionError)) setProgress((current) => current ? { ...current, stage: "FAILED", detail: humanizeError(nextError).message } : null);
    }
  }

  return <div className="page-stack narrow-page">
    <div className="back-link"><Link href="/app/listings"><Icon name="arrow" size={14} />Back to listings</Link></div>
    <section className="page-intro"><div><div className="eyebrow">New record</div><h2>Register a product listing</h2><p>Create the contract-backed identity that future recall checks will evaluate. Keep the ordinary fields human-readable; technical commitments stay below.</p></div></section>
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}{error instanceof PendingTransactionError && <span className="notice-followup"> Reconcile the same hash from the recall check screen; do not resubmit.</span>}</Notice>}
    {wallet && !isCorrectNetwork && <Notice tone="warning" title="Wrong network">Switch to the configured GenLayer network before sending this registration.<button className="text-button" type="button" onClick={() => void switchNetwork()} disabled={connecting}>{connecting ? "Switching..." : "Switch network"}</button></Notice>}
    {progress && progress.stage !== "STATE_CONFIRMED" && <TransactionProgress current={progress.stage} hash={progress.hash} detail={progress.detail} />}
    <form className="surface form-surface" onSubmit={(event) => void submit(event)}>
      <div className="form-section"><div className="form-section-title"><span className="section-number">01</span><div><h3>Stable listing identity</h3><p>These fields bind the record to a marketplace listing. Product name and evidence can change without creating a new identity.</p></div></div><div className="form-grid"><Field label="Marketplace host" required value={form.marketplaceHost} onChange={(value) => update("marketplaceHost", value)} placeholder="marketplace.example" /><Field label="External listing ID" required value={form.externalListingId} onChange={(value) => update("externalListingId", value)} placeholder="Marketplace listing ID" /><Field label="Product or listing name" required value={form.productName} onChange={(value) => update("productName", value)} placeholder="Example Pump XP-100" /><Field label="Product ID" required value={form.productId} onChange={(value) => update("productId", value)} placeholder="Internal SKU or product code" /><Field label="Manufacturer" required value={form.manufacturer} onChange={(value) => update("manufacturer", value)} placeholder="Manufacturer name" /><Field label="Model" required value={form.model} onChange={(value) => update("model", value)} placeholder="Model or family" /><Field label="Serial or lot" value={form.serialOrLot} onChange={(value) => update("serialOrLot", value)} placeholder="Serial range, lot, or batch (if applicable)" /></div></div>
      <div className="form-section"><div className="form-section-title"><span className="section-number">02</span><div><h3>Public evidence</h3><p>These URLs are stored as evidence references and re-fetched by the Intelligent Contract.</p></div></div><div className="form-grid"><Field className="field-span-2" label="Public product or listing URL" required type="url" value={form.listingUrl} onChange={(value) => update("listingUrl", value)} placeholder="https://marketplace.example/products/xp-100" /><Field className="field-span-2" label="Listing evidence URL" required type="url" value={form.evidenceUrl} onChange={(value) => update("evidenceUrl", value)} placeholder="https://manufacturer.example/notices/product" /></div><div className="source-note"><Icon name="shield" size={17} /><span>The source text is untrusted evidence. RecallGuard checks availability, UTF-8 encoding, size, and exact integrity on-chain before semantic evaluation.</span></div></div>
      <details className="form-advanced"><summary><span><Icon name="network" size={16} />Advanced / technical details</span><span className="summary-hint">Required for the contract commitment</span></summary><div className="advanced-body"><div className="hash-input-row"><label className="field-label field-span-2">Evidence SHA-256 commitment<input required pattern="[a-f0-9]{64}" value={form.evidenceSha256} onChange={(event) => update("evidenceSha256", event.target.value.toLowerCase())} placeholder="64 lowercase hexadecimal characters" /></label><button type="button" className="button button-secondary hash-button" onClick={() => void hashEvidence()} disabled={hashing}>{hashing ? "Hashing..." : "Fetch & hash source"}</button></div>{hashMessage && <p className="field-help">{hashMessage}</p>}<p className="field-help">The browser-side helper is only a convenience for preparing the commitment. The contract independently fetches the URL and verifies the same digest.</p></div></details>
      <div className="form-footer"><div><strong>Ready to register?</strong><span>This creates a “Not yet assessed” record. Registration never implies clearance.</span></div><button className="button button-primary button-large" type="submit" disabled={Boolean(progress && progress.stage !== "FAILED")}>{progress && progress.stage !== "FAILED" ? "Waiting for finality..." : "Register listing"}<Icon name="arrow" size={16} /></button></div>
    </form>
    {info && <TechnicalDetails><div className="detail-grid"><span>Recall authorities</span><code>{info.authorized_recall_domains.join(" · ")}</code><span>Marketplace policy</span><code>{info.authorized_marketplace_domains.join(" · ")}</code><span>Listing evidence policy</span><code>{info.authorized_listing_evidence_domains.join(" · ")}</code><span>Maximum evidence</span><code>{info.max_evidence_bytes.toLocaleString()} bytes</code></div></TechnicalDetails>}
  </div>;
}

function Field({ label, value, onChange, placeholder, required = false, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string; className?: string }) {
  return <label className={`field-label ${className}`}><span>{label}{required && <em>*</em>}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
