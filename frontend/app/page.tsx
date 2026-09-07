"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { RecallGuardContract, PendingTransactionError } from "../lib/contracts/RecallGuard";
import { connectWallet, currentWallet, CONTRACT_ADDRESS } from "../lib/genlayer/client";
import type { PendingTransaction } from "../lib/transactions/persistence";
import type { Assessment, Listing } from "../lib/types";

const emptyListing = { productId: "", productName: "", manufacturer: "", model: "", serialOrLot: "", listingUrl: "", evidenceUrl: "", evidenceSha256: "" };

export default function Home() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [listing, setListing] = useState(emptyListing);
  const [recall, setRecall] = useState({ listingId: "", recallUrl: "", recallSha256: "" });
  const [records, setRecords] = useState<Array<{ listing: Listing; assessment?: Assessment }>>([]);
  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [message, setMessage] = useState<{ text: string; tone?: "error" | "warn" }>({ text: "Read-only contract state is available after configuration." });
  const [busy, setBusy] = useState(false);

  const contract = useMemo(() => (CONTRACT_ADDRESS ? new RecallGuardContract(CONTRACT_ADDRESS, wallet || undefined) : null), [wallet]);

  useEffect(() => { void currentWallet().then(setWallet); }, []);
  useEffect(() => { setPending(contract?.listPendingTransactions() || []); }, [contract]);

  async function connect() {
    try { setWallet(await connectWallet()); setMessage({ text: "Wallet connected. Writes will be signed by this account." }); }
    catch (error) { setMessage({ text: String(error), tone: "error" }); }
  }

  async function refresh() {
    if (!contract) return setMessage({ text: "Set NEXT_PUBLIC_CONTRACT_ADDRESS before reading contract state.", tone: "warn" });
    setBusy(true);
    try {
      const ids = await contract.getListingIds();
      const next = await Promise.all(ids.slice(-12).map(async (id) => ({ listing: await contract.getListing(id) })));
      setRecords(next);
      setPending(contract.listPendingTransactions());
      setMessage({ text: `Loaded ${next.length} listing record${next.length === 1 ? "" : "s"} from RecallGuard.` });
    } catch (error) { setMessage({ text: String(error), tone: "error" }); }
    finally { setBusy(false); }
  }

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!contract || !wallet) return setMessage({ text: "Connect a wallet and configure the contract address first.", tone: "warn" });
    setBusy(true);
    try {
      const result = await contract.registerListing({ ...listing, walletAddress: wallet });
      setRecall((value) => ({ ...value, listingId: result.listingId }));
      setMessage({ text: `Listing finalized on-chain. ID: ${result.listingId}. Transaction: ${result.hash}` });
      await refresh();
    } catch (error) {
      const text = error instanceof PendingTransactionError ? `${error.message} Refresh or reconcile the same hash; do not rebroadcast.` : String(error);
      setMessage({ text, tone: "error" });
    } finally { setPending(contract.listPendingTransactions()); setBusy(false); }
  }

  async function assess(event: FormEvent) {
    event.preventDefault();
    if (!contract || !wallet) return setMessage({ text: "Connect a wallet and configure the contract address first.", tone: "warn" });
    setBusy(true);
    try {
      const result = await contract.requestAssessment({ ...recall, walletAddress: wallet });
      setMessage({ text: `Assessment finalized on-chain. The stored attestation is ${result.assessmentId}. Transaction: ${result.hash}` });
      await refresh();
    } catch (error) {
      const text = error instanceof PendingTransactionError ? `${error.message} Refresh or reconcile the same hash; do not rebroadcast.` : String(error);
      setMessage({ text, tone: "error" });
    } finally { setPending(contract.listPendingTransactions()); setBusy(false); }
  }

  async function reconcile(hash: string) {
    if (!contract) return;
    setBusy(true);
    try {
      await contract.reconcilePending(hash);
      setMessage({ text: `Reconciled ${hash} against finalized execution and expected contract state.` });
      await refresh();
    } catch (error) {
      setMessage({ text: `${String(error)} No new transaction was broadcast.`, tone: "error" });
      setPending(contract.listPendingTransactions());
    } finally { setBusy(false); }
  }

  return <main className="shell">
    <div className="wrap">
      <nav className="nav"><div className="brand"><div className="mark">R</div><div><strong>RecallGuard</strong><small>evidence-bound recall applicability</small></div></div><button className="button" onClick={connect}>{wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect wallet"}</button></nav>
      <section className="hero"><div className="eyebrow">GenLayer project · hour 1 integration</div><h1>Keep unsafe listings out of circulation.</h1><p>Register a product listing, bind public evidence to exact hashes, and ask the Intelligent Contract whether an authoritative recall notice applies. RecallGuard owns the verdict; this interface only submits and reads it.</p><div className="state-row"><span className={`dot ${CONTRACT_ADDRESS ? "live" : ""}`} />{CONTRACT_ADDRESS ? "Contract configured" : "Contract address not configured"}</div></section>
      <section className="grid">
        <form className="panel" onSubmit={register}><h2>Register a listing</h2><p>All identity and evidence fields are committed into the contract. The browser calculates an ID preview, but the contract is authoritative.</p><div className="formgrid">
          <label>Product ID<input required value={listing.productId} onChange={(e) => setListing({ ...listing, productId: e.target.value })} /></label>
          <label>Product name<input required value={listing.productName} onChange={(e) => setListing({ ...listing, productName: e.target.value })} /></label>
          <label>Manufacturer<input required value={listing.manufacturer} onChange={(e) => setListing({ ...listing, manufacturer: e.target.value })} /></label>
          <label>Model<input required value={listing.model} onChange={(e) => setListing({ ...listing, model: e.target.value })} /></label>
          <label>Serial / lot<input required value={listing.serialOrLot} onChange={(e) => setListing({ ...listing, serialOrLot: e.target.value })} /></label>
          <label>Listing URL<input required type="url" placeholder="https://…" value={listing.listingUrl} onChange={(e) => setListing({ ...listing, listingUrl: e.target.value })} /></label>
          <label className="full">Listing evidence URL<input required type="url" placeholder="https://public-source.example/product" value={listing.evidenceUrl} onChange={(e) => setListing({ ...listing, evidenceUrl: e.target.value })} /></label>
          <label className="full">Evidence SHA-256<input required pattern="[a-f0-9]{64}" placeholder="64 lowercase hex characters" value={listing.evidenceSha256} onChange={(e) => setListing({ ...listing, evidenceSha256: e.target.value })} /></label>
        </div><div className="actions"><button className="button primary" disabled={busy} type="submit">{busy ? "Waiting for finality…" : "Register on-chain"}</button></div></form>
        <form className="panel" onSubmit={assess}><h2>Request an assessment</h2><p>The contract fetches both sources, verifies integrity, runs the semantic evaluator, and transitions listing state only after consensus.</p><div className="formgrid">
          <label className="full">Listing ID<input required value={recall.listingId} onChange={(e) => setRecall({ ...recall, listingId: e.target.value })} /></label>
          <label className="full">Official recall URL<input required type="url" placeholder="https://configured-authority.example/notice" value={recall.recallUrl} onChange={(e) => setRecall({ ...recall, recallUrl: e.target.value })} /></label>
          <label className="full">Recall notice SHA-256<input required pattern="[a-f0-9]{64}" placeholder="64 lowercase hex characters" value={recall.recallSha256} onChange={(e) => setRecall({ ...recall, recallSha256: e.target.value })} /></label>
        </div><div className="actions"><button className="button primary" disabled={busy} type="submit">{busy ? "Awaiting attestation…" : "Evaluate applicability"}</button></div></form>
        <section className="panel wide"><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><h2>On-chain listings</h2><p>Verdicts and states below are read from RecallGuard after finalized execution. No client-side risk score or verdict is computed.</p></div><button className="button" onClick={() => void refresh()} disabled={busy}>Refresh state</button></div><div className={`status ${message.tone || ""}`}>{message.text}</div><div className="records">{records.length === 0 ? <div className="note">No listings loaded yet.</div> : records.map(({ listing: item }) => <div className="record" key={item.id}><div><strong>{item.product_name} · {item.model}</strong><code>{item.id}</code><div className="note">{item.manufacturer} · {item.serial_or_lot}</div></div><span className={`pill ${item.state.toLowerCase()}`}>{item.state}</span></div>)}</div></section>
      {pending.length > 0 && <section className="panel pending-panel"><h2>Transactions requiring reconciliation</h2><p>These hashes were persisted before polling became ambiguous. Reconcile the same hash; this control never broadcasts again.</p>{pending.map((item) => <div className="pending-row" key={item.hash}><div><code>{item.hash}</code><div className="note">{item.method} · {item.status}</div></div><button className="button" disabled={busy} onClick={() => void reconcile(item.hash)}>Reconcile same hash</button></div>)}</section>}
      </section>
      <footer className="footer">RecallGuard treats official pages as mutable evidence. A transaction hash, ACCEPTED status, or finality without successful execution and expected state is not presented as success.</footer>
    </div>
  </main>;
}
