"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../components/Surface";
import { TransactionProgress } from "../../../components/TransactionProgress";
import { StateBadge, VerdictBadge } from "../../../components/StatusBadge";
import { PendingTransactionError, type TransactionProgress as TxProgress } from "../../../lib/contracts/RecallGuard";
import { useContractSnapshot } from "../../../lib/hooks/useContractSnapshot";
import { useWallet } from "../../../lib/hooks/useWallet";
import { humanizeError, shortHash } from "../../../lib/ui";

export default function ChecksPage({ initialListingId = "" }: { initialListingId?: string }) {
  const router = useRouter();
  const { contract, listings, assessments, info, loading, error, configured, refresh: refreshContract } = useContractSnapshot();
  const { wallet, isCorrectNetwork, switchNetwork, connecting } = useWallet();
  const [listingId, setListingId] = useState(initialListingId);
  const [recallIdentifier, setRecallIdentifier] = useState("");
  const [progress, setProgress] = useState<TxProgress | null>(null);
  const [errorState, setErrorState] = useState<unknown>(null);
  const [pending, setPending] = useState(contract?.listPendingTransactions() || []);
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("listingId");
    if (fromUrl) setListingId(fromUrl);
    else if (initialListingId) setListingId(initialListingId);
  }, [initialListingId]);

  useEffect(() => {
    const entries = contract?.listPendingTransactions() || [];
    setPending(entries);
    const recover = entries[0];
    if (!contract || !recover || attempted.current.has(recover.hash)) return;
    attempted.current.add(recover.hash);
    setProgress({ stage: "RECONCILING", hash: recover.hash, detail: "A persisted transaction was found. Reconnecting without broadcasting." });
    void contract.reconcilePending(recover.hash, setProgress).then(() => {
      setPending(contract.listPendingTransactions());
      void refreshContract();
    }).catch((nextError) => {
      setErrorState(nextError);
      setPending(contract.listPendingTransactions());
    });
  }, [contract, refreshContract]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setErrorState(null);
    if (!contract || !configured) { setErrorState(new Error("CONFIGURATION:CONTRACT_ADDRESS_MISSING")); return; }
    if (!wallet) { setErrorState(new Error("WALLET:DISCONNECTED")); return; }
    if (!isCorrectNetwork) { setErrorState(new Error("NETWORK:WRONG_CHAIN")); return; }
    if (!listingId) { setErrorState(new Error("INPUT:LISTING_REQUIRED")); return; }
    if (!recallIdentifier.trim()) { setErrorState(new Error("INPUT:CPSC_RECALL_IDENTIFIER_REQUIRED")); return; }
    setProgress({ stage: "PRECONDITION_READ", detail: "Reading the registered listing before permissionless submission" });
    try {
      const result = await contract.requestAssessment({ listingId, recallIdentifier, walletAddress: wallet }, setProgress);
      router.push(`/app/assessments/${result.assessmentId}`);
    } catch (nextError) {
      setErrorState(nextError);
      setProgress((current) => current ? { ...current, stage: "FAILED", detail: humanizeError(nextError).message } : null);
    }
  }

  async function reconcile(hash: string) {
    if (!contract) return;
    setProgress({ stage: "RECONCILING", hash, detail: "Reconnecting to the existing transaction; no new broadcast." });
    try { await contract.reconcilePending(hash, setProgress); setPending(contract.listPendingTransactions()); await refreshContract(); }
    catch (nextError) { setErrorState(nextError); setPending(contract.listPendingTransactions()); }
  }

  return <div className="page-stack">
    <section className="page-intro"><div><div className="eyebrow">Permissionless challenge</div><h2>Check against a recall</h2><p>Any connected wallet can ask RecallGuard to evaluate registered product facts against an authoritative CPSC recall record. The listing owner cannot suppress or overwrite a third-party check.</p></div><Link className="button button-secondary" href="/app/listings"><Icon name="box" size={16} />View listings</Link></section>
    {Boolean(errorState) && <Notice tone="danger" title={humanizeError(errorState).title}>{humanizeError(errorState).message}{errorState instanceof PendingTransactionError && " The original transaction ID remains available for reconciliation."}</Notice>}
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice>}
    {wallet && !isCorrectNetwork && <Notice tone="warning" title="Wrong network">Switch to GenLayer Bradbury before requesting a check.<button className="text-button" type="button" onClick={() => void switchNetwork()} disabled={connecting}>{connecting ? "Switching..." : "Switch network"}</button></Notice>}
    {progress && <TransactionProgress current={progress.stage} hash={progress.hash} detail={progress.detail} reconcile={progress.stage === "RECONCILING"} />}
    {pending.length > 0 && <section className="surface pending-surface"><div className="section-heading"><div><div className="eyebrow">Recovery queue</div><h3>Transactions awaiting reconciliation</h3></div><span className="section-count">{pending.length}</span></div><p className="section-lede">These transaction IDs were saved before completion was confirmed. Reconcile the same ID; never submit a replacement because polling timed out.</p>{pending.map((entry) => <div className="pending-row" key={entry.hash}><div><strong>{entry.method === "request_assessment" ? "Recall check" : "Listing registration"}</strong><code>{shortHash(entry.hash, 12, 8)}</code></div><button className="button button-secondary" type="button" onClick={() => void reconcile(entry.hash)}>Reconcile</button></div>)}</section>}
    <div className="content-grid check-layout"><form className="surface form-surface check-form" onSubmit={(event) => void submit(event)}><div className="section-heading"><div><div className="eyebrow">New assessment</div><h3>Challenge a listing</h3></div><span className="secure-label"><Icon name="shield" size={14} />Permissionless</span></div><p className="section-lede">The contract constructs the CPSC request from this bounded recall identifier. The browser does not submit a URL, a body hash, or a model verdict.</p><label className="field-label"><span>Tracked listing<em>*</em></span><select required value={listingId} onChange={(event) => setListingId(event.target.value)}><option value="">Select a listing</option>{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.product_name} · {listing.model} · {listing.state}</option>)}</select></label><label className="field-label"><span>CPSC recall number<em>*</em></span><input required value={recallIdentifier} onChange={(event) => setRecallIdentifier(event.target.value)} placeholder="For example, 26741" autoComplete="off" /></label><div className="authority-hint"><Icon name="network" size={15} /><span>{info?.cpsc_authority || "United States Consumer Product Safety Commission"} · {info?.cpsc_host || "www.saferproducts.gov"}{info?.cpsc_path || "/RestWebServices/Recall"}</span></div><div className="source-note"><Icon name="shield" size={17} /><span>Validators independently retrieve and adjudicate the same official CPSC record. A source failure creates no business verdict.</span></div><div className="form-footer"><div><strong>{listings.length ? "Ready to check" : "Register a listing first"}</strong><span>{listings.length ? "Your address is stored as the requester; ownership is not required." : "The challenge form becomes available after a listing exists."}</span></div><button className="button button-primary button-large" type="submit" disabled={!listings.length || Boolean(progress && !["FAILED", "STATE_CONFIRMED"].includes(progress.stage))}>{progress && progress.stage !== "FAILED" ? "Processing..." : "Submit recall check"}<Icon name="arrow" size={16} /></button></div></form><section className="surface section-card recent-checks"><div className="section-heading"><div><div className="eyebrow">Contract records</div><h3>Recorded assessments</h3></div><span className="section-count">{assessments.length}</span></div>{loading ? <div className="loading-stack"><div className="skeleton-row" /><div className="skeleton-row" /></div> : assessments.length === 0 ? <EmptyState icon="scan" title="No assessments yet" body="A successful contract execution records a permissionless check with its verdict and resulting listing state." /> : <div className="assessment-list">{[...assessments].reverse().slice(0, 6).map((assessment) => { const listing = listings.find((item) => item.id === assessment.listing_id); return <Link className="assessment-row compact" href={`/app/assessments/${assessment.id}`} key={assessment.id}><div className="assessment-icon"><Icon name="shield" size={15} /></div><div className="assessment-main"><strong>{listing?.product_name || "Listing record"}</strong><span>{shortHash(assessment.id)} · recorded on contract</span></div><div className="assessment-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div></Link>; })}</div>}</section></div>
    <TechnicalDetails><div className="detail-grid"><span>Assessment output</span><code>Strict structure: recall identity, snapshot hash, verdict</code><span>Failure behavior</span><code>No business verdict and no state mutation</code><span>Aggregation</span><code>AFFECTED &gt; INCONCLUSIVE &gt; NOT_AFFECTED</code></div></TechnicalDetails>
  </div>;
}
