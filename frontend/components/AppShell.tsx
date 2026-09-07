"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CONTRACT_ADDRESS } from "../lib/genlayer/client";
import { humanizeError, shortHash } from "../lib/ui";
import { useWallet, WalletProvider } from "../lib/hooks/useWallet";
import { Icon, type IconName } from "./Icon";

const navItems: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/app", label: "Overview", icon: "grid" },
  { href: "/app/listings", label: "Listings", icon: "box" },
  { href: "/app/checks", label: "Recall checks", icon: "scan" },
  { href: "/app/attestations", label: "Attestations", icon: "shield" },
  { href: "/app/activity", label: "Activity", icon: "activity" },
];

function ShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { wallet, networkLabel, providerAvailable, connecting, isCorrectNetwork, connect, switchNetwork } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletError, setWalletError] = useState("");
  const title = pathname === "/app" ? "Overview" : navItems.find((item) => pathname.startsWith(item.href))?.label || "RecallGuard";

  async function handleConnect() {
    try { setWalletError(""); await connect(); } catch (error) { setWalletError(humanizeError(error).message); }
  }

  async function handleSwitch() {
    try { setWalletError(""); await switchNetwork(); } catch (error) { setWalletError(humanizeError(error).message); }
  }

  return <div className="app-frame">
    <aside className={`app-sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sidebar-top"><Link href="/" className="app-brand" onClick={() => setMobileOpen(false)}><span className="brand-mark">R</span><span><strong>RecallGuard</strong><small>Safety operations</small></span></Link><button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><Icon name="close" /></button></div>
      <div className="sidebar-kicker">Workspace</div>
      <nav className="sidebar-nav" aria-label="Application navigation">{navItems.map((item) => { const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={`sidebar-link ${active ? "active" : ""}`} onClick={() => setMobileOpen(false)}><Icon name={item.icon} size={17} /><span>{item.label}</span>{active && <span className="nav-active-line" />}</Link>; })}</nav>
      <div className="sidebar-bottom"><div className={`contract-health ${CONTRACT_ADDRESS ? "configured" : ""}`}><span className="health-dot" /><div><strong>{CONTRACT_ADDRESS ? "Contract connected" : "Contract setup"}</strong><small>{CONTRACT_ADDRESS ? shortHash(CONTRACT_ADDRESS, 7, 5) : "Address required"}</small></div></div><Link className="sidebar-docs" href="/#how-it-works"><Icon name="link" size={15} />How it works</Link></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <div className="app-main">
      <header className="app-topbar"><div className="topbar-left"><button className="icon-button menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button><div><div className="breadcrumb">Workspace <span>/</span> {title}</div><h1>{title}</h1></div></div><div className="topbar-actions"><div className={`network-status ${isCorrectNetwork ? "good" : wallet ? "warn" : ""}`}><span className="health-dot" /><span>{wallet ? (isCorrectNetwork ? networkLabel : "Wrong network") : "Wallet disconnected"}</span></div>{wallet && !isCorrectNetwork ? <button className="button button-small button-warning" onClick={() => void handleSwitch()} disabled={connecting}>{connecting ? "Switching..." : "Switch network"}</button> : <button className="account-button" onClick={() => void handleConnect()} disabled={connecting || !providerAvailable}>{wallet ? <><span className="account-avatar">{wallet.slice(2, 4).toUpperCase()}</span><span className="account-copy"><strong>{shortHash(wallet, 6, 4)}</strong><small>{isCorrectNetwork ? "Connected" : "Network action required"}</small></span></> : <><Icon name="network" size={16} /><span>{connecting ? "Connecting..." : providerAvailable ? "Connect wallet" : "Wallet unavailable"}</span></>}</button>}</div></header>
      {walletError && <div className="wallet-error"><Icon name="alert" size={15} />{walletError}</div>}
      <div className="mobile-nav"><div>{navItems.map((item) => { const active = item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon name={item.icon} size={15} />{item.label}</Link>; })}</div></div>
      <main className="app-content">{children}</main>
    </div>
  </div>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <WalletProvider><ShellContent>{children}</ShellContent></WalletProvider>;
}
