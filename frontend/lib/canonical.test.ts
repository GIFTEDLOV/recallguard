import { describe, expect, it } from "vitest";
import { assessmentId, canonicalListingIdentity, listingId } from "./canonical";

const identity = {
  marketplaceHost: "Market.Example",
  externalListingId: "External-001",
  productId: " PROD-001 ",
  manufacturer: "Example Manufacturer",
  model: "XP-100",
  serialOrLot: "LOT-7",
};

describe("V2 canonical identities", () => {
  it("matches the contract's JSON-array identity canonicalization", () => {
    expect(canonicalListingIdentity(identity)).toBe('["market.example","external-001","prod-001","example manufacturer","xp-100","lot-7"]');
  });

  it("matches the Python contract listing ID vector", async () => {
    await expect(listingId(identity)).resolves.toBe("ce491e88ea9ad45c41b59868b7b1f6d5fd75834a9baf2312e00050730014cc88");
  });

  it("keeps assessment identity independent of listing evidence hash", async () => {
    await expect(assessmentId("ce491e88ea9ad45c41b59868b7b1f6d5fd75834a9baf2312e00050730014cc88", "https://recalls.example.gov/notice/1", "a".repeat(64))).resolves.toBe("70ba4aec335b52202936804c13c41aabc972e95c8ab608931e614345d303c6f4");
  });
});
