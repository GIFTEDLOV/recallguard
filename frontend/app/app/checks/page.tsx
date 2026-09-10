"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../../../components/Icon";
import { EmptyState, Notice, TechnicalDetails } from "../../../components/Surface";
import { TransactionProgress } from "../../../components/TransactionProgress";
import { StateBadge, VerdictBadge } from "../../../components/StatusBadge";
import { PendingTransactionError, type TransactionProgress as TxProgress } from "../../../lib/contracts/RecallGuard";
import { sha256Hex } from "../../../lib/canonical";
import { useContractSnapshot } from "../../../lib/hooks/useContractSnapshot";
import { useWallet } from "../../../lib/hooks/useWallet";
import { humanizeError, shortHash } from "../../../lib/ui";

export default function ChecksPage({ initialListingId = "" }: { initialListingId?: string }) {
  const router = useRouter();
  const { contract, listings, assessments, info, loading, error, configured, refresh: refreshContract } = useContractSnapshot();
  const { wallet, isCorrectNetwork, switchNetwork, connecting } = useWallet();
  const [listingId, setListingId] = useState(initialListingId);
  const [recallUrl, setRecallUrl] = useState("");
  const [recallSha256, setRecallSha256] = useState("");
  const [hashing, setHashing] = useState(false);
  const [hashMessage, setHashMessage] = useState("");
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

  async function hashRecall() {
    if (!recallUrl) { setHashMessage("Add the official recall URL first."); return; }
    setHashing(true); setHashMessage("");
    try {
      const response = await fetch(recallUrl);
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      setRecallSha256(await sha256Hex(await response.text()));
      setHashMessage("Commitment calculated from the response available to this browser.");
    } catch (nextError) {
      setHashMessage(`Could not calculate automatically: ${String(nextError).replace(/^Error:\s*/i, "")}`);
    } finally { setHashing(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setErrorState(null);
    if (!contract || !configured) { setErrorState(new Error("Contract address is not configured")); return; }
    if (!wallet) { setErrorState(new Error("Connect a wallet before requesting a permissionless assessment")); return; }
    if (!isCorrectNetwork) { setErrorState(new Error("Switch to the configured GenLayer network before submitting")); return; }
    if (!listingId) { setErrorState(new Error("Select a listing to assess")); return; }
    setProgress({ stage: "PRECONDITION_READ", detail: "Reading the listing before permissionless submission" });
    try {
      const result = await contract.requestAssessment({ listingId, recallUrl, recallSha256, walletAddress: wallet }, setProgress);
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
    <section className="page-intro"><div><div className="eyebrow">Permissionless challenge</div><h2>Check against a recall</h2><p>Any connected wallet can ask RecallGuard to evaluate a tracked listing against an admissible recall notice. The listing owner cannot suppress or overwrite a third-party check.</p></div><Link className="button button-secondary" href="/app/listings"><Icon name="box" size={16} />View listings</Link></section>
    {Boolean(errorState) && <Notice tone="danger" title={humanizeError(errorState).title}>{humanizeError(errorState).message}{errorState instanceof PendingTransactionError && " The original hash remains available for reconciliation."}</Notice>}
    {Boolean(error) && <Notice tone="danger" title={humanizeError(error).title}>{humanizeError(error).message}</Notice>}
    {wallet && !isCorrectNetwork && <Notice tone="warning" title="Wrong network">Switch to the configured GenLayer network before requesting a check.<button className="text-button" type="button" onClick={() => void switchNetwork()} disabled={connecting}>{connecting ? "Switching..." : "Switch network"}</button></Notice>}
    {progress && <TransactionProgress current={progress.stage} hash={progress.hash} detail={progress.detail} reconcile={progress.stage === "RECONCILING"} />}
    {pending.length > 0 && <section className="surface pending-surface"><div className="section-heading"><div><div className="eyebrow">Recovery queue</div><h3>Transactions awaiting reconciliation</h3></div><span className="section-count">{pending.length}</span></div><p className="section-lede">The application saved these hashes before it could confirm the result. Reconcile the same hash; never submit a second transaction.</p>{pending.map((entry) => <div className="pending-row" key={entry.hash}><div><strong>{entry.method === "request_assessment" ? "Recall check" : "Listing registration"}</strong><code>{shortHash(entry.hash, 12, 8)}</code></div><button className="button button-secondary" type="button" onClick={() => void reconcile(entry.hash)}>Reconcile</button></div>)}</section>}
    <div className="content-grid check-layout"><form className="surface form-surface check-form" onSubmit={(event) => void submit(event)}><div className="section-heading"><div><div className="eyebrow">New assessment</div><h3>Challenge a listing</h3></div><span className="secure-label"><Icon name="shield" size={14} />Permissionless</span></div><p className="section-lede">The evidence and decision are evaluated by the contract after the transaction reaches the network. The requester is stored for provenance; ownership is not required.</p><label className="field-label"><span>Tracked listing<em>*</em></span><select required value={listingId} onChange={(event) => setListingId(event.target.value)}><option value="">Select a listing</option>{listings.map((listing) => <option key={listing.id} value={listing.id}>{listing.product_name} · {listing.model} · {listing.state}</option>)}</select></label><label className="field-label"><span>Official recall URL<em>*</em></span><input required type="url" value={recallUrl} onChange={(event) => setRecallUrl(event.target.value)} placeholder="https://authority.example/recall-notice" /></label><div className="authority-hint"><Icon name="network" size={15} /><span>Configured authorities: {info?.authorized_recall_domains?.length ? info.authorized_recall_domains.join(" · ") : "Read from contract"}</span></div><details className="form-advanced open-advanced"><summary><span><Icon name="shield" size={16} />Evidence commitment</span><span className="summary-hint">Required for integrity</span></summary><div className="advanced-body"><label className="field-label"><span>Recall notice SHA-256<em>*</em></span><input required pattern="[a-f0-9]{64}" value={recallSha256} onChange={(event) => setRecallSha256(event.target.value.toLowerCase())} placeholder="64 lowercase hexadecimal characters" /></label><button type="button" className="button button-secondary" onClick={() => void hashRecall()} disabled={hashing}>{hashing ? "Hashing source..." : "Fetch & hash source"}</button>{hashMessage && <p className="field-help">{hashMessage}</p>}<p className="field-help">A source hash commits the bytes assessed. The contract independently fetches and verifies the source; browser text is never authoritative.</p></div></details><div className="form-footer"><div><strong>{listings.length ? "Ready to check" : "Register a listing first"}</strong><span>{listings.length ? "A failed evaluation will not change listing state." : "The challenge form becomes available after a listing exists."}</span></div><button className="button button-primary button-large" type="submit" disabled={!listings.length || Boolean(progress && !["FAILED", "STATE_CONFIRMED"].includes(progress.stage))}>{progress && progress.stage !== "FAILED" ? "Processing..." : "Submit recall check"}<Icon name="arrow" size={16} /></button></div></form><section className="surface section-card recent-checks"><div className="section-heading"><div><div className="eyebrow">Contract records</div><h3>Recent checks</h3></div><span className="section-count">{assessments.length}</span></div>{loading ? <div className="loading-stack"><div className="skeleton-row" /><div className="skeleton-row" /></div> : assessments.length === 0 ? <EmptyState icon="scan" title="No assessments yet" body="A finalized permissionless check will appear here with its verdict and resulting listing state." /> : <div className="assessment-list">{[...assessments].reverse().slice(0, 6).map((assessment) => { const listing = listings.find((item) => item.id === assessment.listing_id); return <Link className="assessment-row compact" href={`/app/assessments/${assessment.id}`} key={assessment.id}><div className="assessment-icon"><Icon name="shield" size={15} /></div><div className="assessment-main"><strong>{listing?.product_name || "Listing record"}</strong><span>{shortHash(assessment.id)} · finalized</span></div><div className="assessment-result"><VerdictBadge verdict={assessment.verdict} /><StateBadge state={assessment.state_after} /></div></Link>; })}</div>}</section></div>
    <TechnicalDetails><div className="detail-grid"><span>Assessment output</span><code>Strict JSON object: verdict only</code><span>Failure behavior</span><code>No verdict and no state mutation</code><span>Aggregation</span><code>AFFECTED &gt; INCONCLUSIVE &gt; all NOT_AFFECTED</code></div></TechnicalDetails>
  </div>;
}
