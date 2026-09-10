import { describe, expect, it } from "vitest";
import { assessmentId, canonicalListingIdentity, listingId, noticeId, snapshotId } from "./canonical";

const identity = {
  marketplaceHost: "Market.Example",
  externalListingId: "External-001",
};

describe("V2 canonical identities", () => {
  it("matches the contract's JSON-array identity canonicalization", () => {
    expect(canonicalListingIdentity(identity)).toBe('["v2-stable-marketplace-reference","market.example","external-001"]');
  });

  it("matches the Python contract listing ID vector", async () => {
    await expect(listingId(identity)).resolves.toBe("9c2c7207c9113db97289ba757032296a618ec04ecc3655fa158f2b7ac5a3c1e7");
  });

  it("separates logical notice identity from its evidence snapshot", async () => {
    const firstNotice = await noticeId("https://RECALLS.EXAMPLE.GOV:443/notice/1?utm=one", "NOTICE-1");
    const updatedNotice = await noticeId("https://recalls.example.gov/notice/1?utm=two", "NOTICE-1");
    expect(firstNotice).toBe("a542e3dca71a4f1d0c71560f0a7b6a5b611a1460f407a88773d1e86fce76687c");
    expect(updatedNotice).toBe(firstNotice);
    await expect(snapshotId("https://recalls.example.gov/notice/1", "NOTICE-1", "a".repeat(64))).resolves.toHaveLength(64);
    await expect(assessmentId("9c2c7207c9113db97289ba757032296a618ec04ecc3655fa158f2b7ac5a3c1e7", "https://recalls.example.gov/notice/1", "NOTICE-1", "a".repeat(64))).resolves.toBe("08127628bdcbc586ac302598af958cb8f0fbc2b19336acf2a48cea50857c1cd9");
  });

  it("does not let URL query or evidence changes create a new logical notice", async () => {
    const first = await noticeId("https://recalls.example.gov/notice/1", "NOTICE-1");
    const second = await noticeId("https://recalls.example.gov/notice/1?tracking=attacker", "NOTICE-1");
    expect(second).toBe(first);
    await expect(snapshotId("https://recalls.example.gov/notice/1", "NOTICE-1", "a".repeat(64))).resolves.not.toBe(await snapshotId("https://recalls.example.gov/notice/1", "NOTICE-1", "b".repeat(64)));
  });

  it("canonicalizes host spelling without collapsing separate marketplace namespaces", async () => {
    await expect(listingId({ marketplaceHost: "MARKET.EXAMPLE:443", externalListingId: " External-001 " })).resolves.toBe(await listingId({ marketplaceHost: "market.example.", externalListingId: "external-001" }));
    await expect(listingId({ marketplaceHost: "other-market.example", externalListingId: "external-001" })).resolves.not.toBe(await listingId({ marketplaceHost: "market.example", externalListingId: "external-001" }));
    await expect(listingId({ marketplaceHost: "market.example", externalListingId: "external-002" })).resolves.not.toBe(await listingId({ marketplaceHost: "market.example", externalListingId: "external-001" }));
  });
});
