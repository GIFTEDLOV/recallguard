import type { TransactionStage } from "../lib/contracts/RecallGuard";
import { Icon } from "./Icon";

const stages: Array<{ key: TransactionStage; label: string }> = [
  { key: "PRECONDITION_READ", label: "Preparing assessment" },
  { key: "TRANSACTION_SIGNED", label: "Transaction signed" },
  { key: "SUBMISSION_SENT", label: "Submission sent" },
  { key: "HASH_PERSISTED", label: "Hash persisted" },
  { key: "FINALITY_PENDING", label: "Waiting for finality" },
  { key: "FINALIZED", label: "Finalized" },
  { key: "EXECUTION_VERIFIED", label: "Execution verified" },
  { key: "STATE_CONFIRMED", label: "Listing state confirmed" },
];

const order = new Map(stages.map((stage, index) => [stage.key, index]));

export function TransactionProgress({ current, hash, detail, reconcile = false }: { current: TransactionStage; hash?: string; detail?: string; reconcile?: boolean }) {
  const currentIndex = order.get(current) ?? 0;
  return <div className="tx-progress" aria-live="polite"><div className="tx-progress-heading"><div><div className="eyebrow">{reconcile ? "Recovery" : "GenLayer assessment"}</div><h3>{reconcile ? "Reconnecting to the same transaction" : "Assessment in progress"}</h3></div><span className={`progress-pulse ${current === "FAILED" ? "failed" : current === "STATE_CONFIRMED" ? "done" : ""}`} /></div><div className="progress-steps">{stages.map((stage, index) => { const complete = index < currentIndex || current === "STATE_CONFIRMED" && index <= currentIndex; const active = stage.key === current; return <div className={`progress-step ${complete ? "complete" : ""} ${active ? "active" : ""}`} key={stage.key}><span className="progress-marker">{complete ? <Icon name="check" size={12} /> : index + 1}</span><span>{stage.label}</span></div>; })}</div>{hash && <div className="progress-hash"><span>Transaction hash</span><code>{hash}</code></div>}{detail && <p className="progress-detail">{detail}</p>}</div>;
}
