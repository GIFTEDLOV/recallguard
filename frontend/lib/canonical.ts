function assertPart(value: string, field: string, required = true): string {
  if (typeof value !== "string" || value.includes("\0") || value.includes("|")) {
    throw new Error(`${field} cannot contain reserved characters`);
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
    "v2-stable-marketplace-reference",
    canonicalHost(values.marketplaceHost),
    assertPart(values.externalListingId, "external listing id"),
  ]);
}

export function canonicalHost(value: string): string {
  if (typeof value !== "string" || value.includes("\0") || value.includes("|") || value.includes("/") || value.includes("?") || value.includes("#") || value.includes("@")) {
    throw new Error("marketplace host cannot contain reserved characters");
  }
  let host = value.trim().toLowerCase();
  if (host.endsWith(":443")) host = host.slice(0, -4);
  if (host.endsWith(".")) host = host.slice(0, -1);
  if (!host || !host.includes(".") || host.includes(":") || /\s/.test(host)) throw new Error("marketplace host is invalid");
  return host;
}

export function canonicalHttpsUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("HTTPS is required");
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname === "/") url.pathname = "";
  return url.toString().replace(/\/$/, "");
}

export function canonicalNotice(recallUrl: string, noticeReference: string): string {
  return JSON.stringify(["v2-authority-notice-reference", canonicalHost(new URL(canonicalHttpsUrl(recallUrl)).hostname), assertPart(noticeReference, "notice reference")]);
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser does not provide Web Crypto SHA-256");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function listingId(values: StableListingIdentity): Promise<string> {
  return sha256Hex(canonicalListingIdentity(values));
}

export async function noticeId(recallUrl: string, noticeReference: string): Promise<string> {
  return sha256Hex(canonicalNotice(recallUrl, noticeReference));
}

export async function snapshotId(recallUrl: string, noticeReference: string, recallSha256: string): Promise<string> {
  const logicalNoticeId = await noticeId(recallUrl, noticeReference);
  return sha256Hex(JSON.stringify([logicalNoticeId, assertPart(recallSha256, "recall SHA-256")]));
}

export async function assessmentId(listing: string, recallUrl: string, noticeReference: string, recallSha256: string): Promise<string> {
  const evidenceSnapshotId = await snapshotId(recallUrl, noticeReference, recallSha256);
  return sha256Hex(JSON.stringify([listing, evidenceSnapshotId]));
}
