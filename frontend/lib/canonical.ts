const IDENTITY_VERSION = "v2-stable-marketplace-reference";
const NOTICE_IDENTITY_VERSION = "v2-cpsc-recall-number";

function assertPart(value: string, field: string, required = true): string {
  if (typeof value !== "string" || value.includes("\0") || value.includes("\r") || value.includes("\n") || value.includes("|")) {
    throw new Error(`${field} contains a reserved character`);
  }
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (required && !normalized) throw new Error(`${field} cannot be empty`);
  return normalized;
}

export interface StableListingIdentity {
  marketplaceHost: string;
  externalListingId: string;
}

/** Must remain byte-for-byte equivalent to RecallGuard._canonical_listing_identity. */
export function canonicalListingIdentity(values: StableListingIdentity): string {
  return JSON.stringify([
    IDENTITY_VERSION,
    canonicalHost(values.marketplaceHost),
    assertPart(values.externalListingId, "external listing id"),
  ]);
}

export function canonicalHost(value: string): string {
  if (typeof value !== "string" || value.includes("\0") || value.includes("|") || value.includes("/") || value.includes("?") || value.includes("#") || value.includes("@")) {
    throw new Error("marketplace host is invalid");
  }
  let host = value.trim().toLowerCase();
  if (host.startsWith("https://")) host = host.slice(8);
  if (host.endsWith(":443")) host = host.slice(0, -4);
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (!host || !host.includes(".") || host.includes(":") || /\s/.test(host)) throw new Error("marketplace host is invalid");
  return host;
}

export function canonicalHttpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("HTTPS is required");
  url.hostname = url.hostname.toLowerCase();
  if (url.port === "443") url.port = "";
  if (url.pathname === "/") url.pathname = "";
  return url.toString().replace(/\/$/, "");
}

/** Logical notice identity intentionally contains no URL or page snapshot. */
export function canonicalNotice(recallIdentifier: string): string {
  const normalized = assertPart(recallIdentifier, "CPSC recall identifier").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(normalized) || normalized.length > 32) throw new Error("CPSC recall identifier is invalid");
  return JSON.stringify([NOTICE_IDENTITY_VERSION, "CPSC", normalized]);
}

export interface CpscDecisionFacts {
  recall_id: number;
  recall_number: string;
  recall_date: string;
  title: string;
  description: string;
  products: Array<{ name: string; description: string; model: string; type: string }>;
  manufacturers: Array<{ name: string }>;
  product_upcs: string[];
  hazards: string[];
  remedies: string[];
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

/** Mirrors the contract's sorted decision-facts serialization. */
export function canonicalCpscDecisionFacts(value: CpscDecisionFacts): string {
  const normalized: CpscDecisionFacts = {
    ...value,
    products: [...value.products].map((item) => stableValue(item) as CpscDecisionFacts["products"][number]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    manufacturers: [...value.manufacturers].map((item) => stableValue(item) as CpscDecisionFacts["manufacturers"][number]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    product_upcs: [...value.product_upcs].sort(),
    hazards: [...value.hazards].sort(),
    remedies: [...value.remedies].sort(),
  };
  return JSON.stringify(stableValue(normalized));
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("This browser does not provide Web Crypto SHA-256");
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function listingId(values: StableListingIdentity): Promise<string> {
  return sha256Hex(canonicalListingIdentity(values));
}

export function noticeId(recallIdentifier: string): Promise<string> {
  return sha256Hex(canonicalNotice(recallIdentifier));
}

export function snapshotId(facts: CpscDecisionFacts): Promise<string> {
  return sha256Hex(canonicalCpscDecisionFacts(facts));
}

export async function assessmentId(listing: string, recallIdentifier: string, snapshotSha256: string): Promise<string> {
  return sha256Hex(JSON.stringify([listing, await noticeId(recallIdentifier), snapshotSha256]));
}
