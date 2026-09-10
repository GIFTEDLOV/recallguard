import { describe, expect, it } from "vitest";
import { assessmentId, canonicalCpscDecisionFacts, canonicalListingIdentity, canonicalNotice, listingId, noticeId, snapshotId } from "./canonical";
import type { CpscDecisionFacts } from "./canonical";

const identity = { marketplaceHost: "Market.Example", externalListingId: "External-001" };
const facts: CpscDecisionFacts = {
  recall_id: 10940,
  recall_number: "26741",
  recall_date: "2026-09-03",
  title: "Example recall",
  description: "Decision-relevant description",
  products: [{ name: "Pump", description: "XP-100", model: "XP-100", type: "Pump" }],
  manufacturers: [{ name: "Example Manufacturing" }],
  product_upcs: ["001"],
  hazards: ["Fire"],
  remedies: ["Refund"],
};

describe("V2 canonical identities", () => {
  it("matches the contract's JSON-array identity canonicalization", () => {
    expect(canonicalListingIdentity(identity)).toBe('["v2-stable-marketplace-reference","market.example","external-001"]');
  });

  it("matches the Python contract listing ID vector", async () => {
    await expect(listingId(identity)).resolves.toBe("9c2c7207c9113db97289ba757032296a618ec04ecc3655fa158f2b7ac5a3c1e7");
  });

  it("separates logical notice identity from its canonical fact snapshot", async () => {
    const firstNotice = await noticeId("26741");
    const updatedNotice = await noticeId(" 26741 ");
    expect(firstNotice).toBe(updatedNotice);
    expect(canonicalNotice("26741")).toBe('["v2-cpsc-recall-number","CPSC","26741"]');
    const firstSnapshot = await snapshotId(facts);
    const updatedFacts = { ...facts, description: "Updated decision-relevant description" };
    const updatedSnapshot = await snapshotId(updatedFacts);
    expect(updatedSnapshot).not.toBe(firstSnapshot);
    await expect(assessmentId(identity.externalListingId, "26741", firstSnapshot)).resolves.toHaveLength(64);
  });

  it("keeps irrelevant API field changes outside the snapshot", async () => {
    const first = await snapshotId(facts);
    const reordered = { ...facts, products: [...facts.products].reverse(), manufacturers: [...facts.manufacturers].reverse(), product_upcs: [...facts.product_upcs].reverse() };
    await expect(snapshotId(reordered)).resolves.toBe(first);
  });

  it("protects identity across metadata, URL, and evidence changes", async () => {
    await expect(listingId(identity)).resolves.toBe(await listingId({ marketplaceHost: "MARKET.EXAMPLE:443", externalListingId: " External-001 " }));
    await expect(listingId({ marketplaceHost: "market.example.", externalListingId: "external-001" })).resolves.toBe(await listingId(identity));
    await expect(listingId({ marketplaceHost: "other-market.example", externalListingId: "external-001" })).resolves.not.toBe(await listingId(identity));
    await expect(listingId({ marketplaceHost: "market.example", externalListingId: "external-002" })).resolves.not.toBe(await listingId(identity));
  });
});
