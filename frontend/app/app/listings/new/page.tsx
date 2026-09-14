"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../../../components/Icon";
import { Notice, TechnicalDetails } from "../../../../components/Surface";
import { TransactionProgress } from "../../../../components/TransactionProgress";
import { PendingTransactionError, type TransactionProgress as TxProgress } from "../../../../lib/contracts/RecallGuard";
import { useContractSnapshot } from "../../../../lib/hooks/useContractSnapshot";
import { useWallet } from "../../../../lib/hooks/useWallet";
import { humanizeError } from "../../../../lib/ui";

const initial = { marketplaceHost: "", externalListingId: "", productId: "", productName: "", manufacturer: "", model: "", serialOrLot: "", listingUrl: "" };

export default function NewListingPage() {
  const router = useRouter();
  const { contract, info, configured } = useContractSnapshot();
  const { wallet, isCorrectNetwork, switchNetwork, connecting } = useWallet();
  const [form, setForm] = useState(initial);
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [error, setError] = useState<unknown>(null);

  function update(field: keyof typeof initial, value: string) { setForm((current) => ({ ...current, [field]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!configured || !contract) { setError(new Error("CONFIGURATION:CONTRACT_ADDRESS_MISSING")); return; }
    if (!wallet) { setError(new Error("WALLET:DISCONNECTED")); return; }
    if (!isCorrectNetwork) { setError(new Error("NETWORK:WRONG_CHAIN")); return; }
    setProgress({ stage: "PRECONDITION_READ", detail: "Checking the stable marketplace identity" });
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
    <section className="page-intro"><div><div className="eyebrow">New record</div><h2>Register a product listing</h2><p>Create the durable RecallGuard record that future CPSC checks will evaluate. Registration records facts; it never creates a cleared state.</p></div></section>
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}{error instanceof PendingTransactionError && <span className="notice-followup"> Reconcile the same transaction ID; do not resubmit.</span>}</Notice>}
    {wallet && !isCorrectNetwork && <Notice tone="warning" title="Wrong network">Switch to GenLayer Studio-dev before sending this registration.<button className="text-button" type="button" onClick={() => void switchNetwork()} disabled={connecting}>{connecting ? "Switching..." : "Switch network"}</button></Notice>}
    {progress && progress.stage !== "STATE_CONFIRMED" && <TransactionProgress current={progress.stage} hash={progress.hash} detail={progress.detail} />}
    <form className="surface form-surface" onSubmit={(event) => void submit(event)}>
      <div className="form-section"><div className="form-section-title"><span className="section-number">01</span><div><h3>Stable marketplace identity</h3><p>The identity is the policy version, canonical marketplace host, and external listing ID. Descriptive fields do not create a second identity.</p></div></div><div className="form-grid"><Field label="Marketplace host" required value={form.marketplaceHost} onChange={(value) => update("marketplaceHost", value)} placeholder="amazon.com" /><Field label="External listing ID" required value={form.externalListingId} onChange={(value) => update("externalListingId", value)} placeholder="Marketplace listing ID" /></div></div>
      <div className="form-section"><div className="form-section-title"><span className="section-number">02</span><div><h3>Registered product facts</h3><p>These immutable facts are the inputs to the CPSC applicability question. They are registered by your connected address, not authenticated marketplace claims.</p></div></div><div className="form-grid"><Field label="Product ID" required value={form.productId} onChange={(value) => update("productId", value)} placeholder="SKU or product code" /><Field label="Product or listing name" required value={form.productName} onChange={(value) => update("productName", value)} placeholder="Product name" /><Field label="Manufacturer" required value={form.manufacturer} onChange={(value) => update("manufacturer", value)} placeholder="Manufacturer name" /><Field label="Model" required value={form.model} onChange={(value) => update("model", value)} placeholder="Model or family" /><Field label="Serial or lot" value={form.serialOrLot} onChange={(value) => update("serialOrLot", value)} placeholder="Serial, lot, or batch if applicable" /></div></div>
      <div className="form-section"><div className="form-section-title"><span className="section-number">03</span><div><h3>Informational marketplace link</h3><p>This URL is retained for navigation and context only. Amazon or another marketplace is never fetched or hashed in the consensus path.</p></div></div><div className="form-grid"><Field className="field-span-2" label="Public listing URL" required type="url" value={form.listingUrl} onChange={(value) => update("listingUrl", value)} placeholder="https://marketplace.example/item/123" /></div><div className="source-note"><Icon name="shield" size={17} /><span>RecallGuard does not prove that a marketplace displayed these facts or that a seller supplied them truthfully.</span></div></div>
      <div className="form-footer"><div><strong>Ready to register?</strong><span>This creates an UNASSESSED record: Not yet assessed. Registration never implies clearance.</span></div><button className="button button-primary button-large" type="submit" disabled={Boolean(progress && progress.stage !== "FAILED")}>{progress && progress.stage !== "FAILED" ? "Processing..." : "Register listing"}<Icon name="arrow" size={16} /></button></div>
    </form>
    {info && <TechnicalDetails><div className="detail-grid"><span>CPSC authority</span><code>{info.cpsc_authority}</code><span>CPSC endpoint</span><code>{info.cpsc_host}{info.cpsc_path}</code><span>Marketplace namespaces</span><code>{info.authorized_marketplace_domains.join(" · ")}</code><span>Raw body stored</span><code>{info.raw_cpsc_body_stored ? "Yes" : "No - canonical fields only"}</code></div></TechnicalDetails>}
  </div>;
}

function Field({ label, value, onChange, placeholder, required = false, type = "text", className = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; type?: string; className?: string }) {
  return <label className={`field-label ${className}`}><span>{label}{required && <em>*</em>}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
