export type PendingStatus = "PROVISIONAL" | "RECONCILIATION_REQUIRED" | "FINALIZED_FAILURE";

export interface PendingExpectation {
  listingId?: string;
  assessmentId?: string;
}

export interface PendingTransaction {
  hash: string;
  method: string;
  args: unknown[];
  createdAt: string;
  status: PendingStatus;
  expected?: PendingExpectation;
}

const STORAGE_KEY = "recallguard.pending-transactions.v1";

function read(): PendingTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const entries = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as Array<Partial<PendingTransaction>>;
    return entries.map((entry) => ({
      ...entry,
      status: entry.status || "PROVISIONAL",
    })) as PendingTransaction[];
  } catch {
    return [];
  }
}

function write(entries: PendingTransaction[]): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

export const pendingTransactions = {
  list(): PendingTransaction[] {
    return read();
  },
  save(entry: PendingTransaction): void {
    write([...read().filter((item) => item.hash !== entry.hash), entry]);
  },
  update(hash: string, update: Partial<PendingTransaction>): void {
    write(read().map((item) => (item.hash === hash ? { ...item, ...update } : item)));
  },
  remove(hash: string): void {
    write(read().filter((item) => item.hash !== hash));
  },
};
