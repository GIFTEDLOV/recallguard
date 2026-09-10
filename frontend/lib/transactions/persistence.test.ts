import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pendingTransactions, type PendingTransaction } from "./persistence";

const storage = new Map<string, string>();

function installStorage() {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  });
}

function entry(hash: string): PendingTransaction {
  return {
    hash,
    method: "request_assessment",
    args: ["listing-1", "https://authority.example/recall", "a".repeat(64)],
    createdAt: "2026-09-07T00:00:00.000Z",
    status: "PROVISIONAL",
    expected: { listingId: "listing-1", assessmentId: "assessment-1" },
  };
}

describe("pending transaction persistence", () => {
  beforeEach(() => {
    storage.clear();
    installStorage();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("persists a hash immediately and replaces only the same hash", () => {
    pendingTransactions.save(entry("0xabc"));
    pendingTransactions.save({ ...entry("0xabc"), method: "request_assessment", status: "RECONCILIATION_REQUIRED" });
    pendingTransactions.save(entry("0xdef"));

    expect(pendingTransactions.list()).toHaveLength(2);
    expect(pendingTransactions.list()[0].hash).toBe("0xabc");
    expect(pendingTransactions.list()[0].status).toBe("RECONCILIATION_REQUIRED");
  });

  it("updates and removes a transaction without touching another hash", () => {
    pendingTransactions.save(entry("0xabc"));
    pendingTransactions.save(entry("0xdef"));

    pendingTransactions.update("0xabc", { status: "FINALIZED_FAILURE" });
    pendingTransactions.remove("0xdef");

    expect(pendingTransactions.list()).toEqual([{ ...entry("0xabc"), status: "FINALIZED_FAILURE" }]);
  });

  it("fails closed when browser storage contains malformed data", () => {
    storage.set("recallguard.pending-transactions.v2", "not-json");
    expect(pendingTransactions.list()).toEqual([]);
  });

  it("does not replay a V1 pending hash into the V2 recovery queue", () => {
    storage.set("recallguard.pending-transactions.v1", JSON.stringify([entry("0xold-v1-hash")]));
    expect(pendingTransactions.list()).toEqual([]);
  });

  it("moves a verified hash to the local confirmed index for operational detail views", () => {
    pendingTransactions.save(entry("0xconfirmed"));
    pendingTransactions.confirm("0xconfirmed");

    expect(pendingTransactions.list()).toEqual([]);
    expect(pendingTransactions.confirmed()).toEqual([{
      hash: "0xconfirmed",
      method: "request_assessment",
      createdAt: "2026-09-07T00:00:00.000Z",
      expected: { listingId: "listing-1", assessmentId: "assessment-1" },
    }]);
  });
});
