const SEPARATOR = "|";

function assertCanonicalPart(value: string, field: string): void {
  if (!value || value.includes(SEPARATOR) || value.includes("\0")) {
    throw new Error(`${field} cannot be empty or contain canonical separators`);
  }
}

export function canonicalListing(values: {
  productId: string;
  productName: string;
  manufacturer: string;
  model: string;
  serialOrLot: string;
  listingUrl: string;
  evidenceUrl: string;
  evidenceSha256: string;
}): string {
  const parts = [
    values.productId,
    values.productName,
    values.manufacturer,
    values.model,
    values.serialOrLot,
    values.listingUrl,
    values.evidenceUrl,
    values.evidenceSha256,
  ];
  parts.forEach((part, index) => assertCanonicalPart(part, `listing field ${index}`));
  return parts.join(SEPARATOR);
}

export function canonicalAssessment(
  listingId: string,
  recallUrl: string,
  recallSha256: string,
  listingEvidenceSha256: string,
): string {
  [listingId, recallUrl, recallSha256, listingEvidenceSha256].forEach((part, index) =>
    assertCanonicalPart(part, `assessment field ${index}`),
  );
  return [listingId, recallUrl, recallSha256, listingEvidenceSha256].join(SEPARATOR);
}

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("This browser does not provide Web Crypto SHA-256");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function listingId(values: Parameters<typeof canonicalListing>[0]): Promise<string> {
  return sha256Hex(canonicalListing(values));
}

export async function assessmentId(
  listing: string,
  recallUrl: string,
  recallSha256: string,
  listingEvidenceSha256: string,
): Promise<string> {
  return sha256Hex(canonicalAssessment(listing, recallUrl, recallSha256, listingEvidenceSha256));
}
