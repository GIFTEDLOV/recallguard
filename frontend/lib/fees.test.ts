import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFeeProfile, profileEntry, type FeeProfile } from "./fees";

const entry = {
  leaderTimeunitsAllocation: "10",
  validatorTimeunitsAllocation: "20",
  executionBudgetPerRound: "30",
  totalMessageFees: "0",
  rotationsPerRound: "1",
};

const profile: FeeProfile = {
  version: 1,
  network: "studio-dev",
  chainId: 61997,
  measuredAt: "2026-09-10T00:00:00Z",
  headroom: 1.25,
  deploy: entry,
  methods: { register_listing: entry, request_assessment: entry },
};

afterEach(() => vi.unstubAllGlobals());

describe("v0.6 fee profile loading", () => {
  it("loads the checked-in profile without inventing allocations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 })));
    await expect(loadFeeProfile()).resolves.toEqual(profile);
  });

  it("accepts a finalized localnet measurement profile for Studio-dev fee quoting", async () => {
    const localMeasurement = { ...profile, network: "localnet", chainId: 61999 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(localMeasurement), { status: 200 })));
    await expect(loadFeeProfile()).resolves.toEqual(localMeasurement);
  });

  it("selects the exact write method entry", () => {
    expect(profileEntry(profile, "request_assessment")).toBe(entry);
  });

  it("fails closed when the profile is explicitly not generated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "NOT_GENERATED" }), { status: 200 })));
    await expect(loadFeeProfile()).rejects.toThrow("FEE_PROFILE_REQUIRED");
  });

  it("fails closed when the profile endpoint is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("offline", { status: 503 })));
    await expect(loadFeeProfile()).rejects.toThrow("FEE_PROFILE_UNAVAILABLE:HTTP_503");
  });

  it("does not allow a missing method entry to fall back to a guessed fee", () => {
    expect(() => profileEntry({ ...profile, methods: {} }, "register_listing")).toThrow("FEE_PROFILE_REQUIRED");
  });
});
