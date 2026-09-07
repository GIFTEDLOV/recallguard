import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function EmptyState({ icon = "box", eyebrow, title, body, action }: { icon?: IconName; eyebrow?: string; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={22} /></div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h3>{title}</h3><p>{body}</p>{action && <div className="empty-action">{action}</div>}</div>;
}

export function Notice({ tone = "neutral", title, children }: { tone?: "neutral" | "warning" | "danger" | "success"; title?: string; children: ReactNode }) {
  return <div className={`notice notice-${tone}`} role={tone === "danger" ? "alert" : undefined}><div className="notice-mark"><Icon name={tone === "success" ? "check" : tone === "neutral" ? "network" : "alert"} size={16} /></div><div>{title && <strong>{title}</strong>}<div>{children}</div></div></div>;
}

export function TechnicalDetails({ children }: { children: ReactNode }) {
  return <details className="technical"><summary>Technical details</summary><div className="technical-body">{children}</div></details>;
}

export function CopyValue({ value }: { value: string }) {
  async function copy() {
    if (navigator.clipboard) await navigator.clipboard.writeText(value);
  }
  return <button className="copy-button" type="button" onClick={() => void copy()} aria-label="Copy value"><span>{value}</span><Icon name="copy" size={14} /></button>;
}
