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

export interface ConfirmedTransaction {
  hash: string;
  method: string;
  createdAt: string;
  expected?: PendingExpectation;
}

const STORAGE_KEY = "recallguard.pending-transactions.v2";
const CONFIRMED_STORAGE_KEY = "recallguard.confirmed-transactions.v2";

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

function readConfirmed(): ConfirmedTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CONFIRMED_STORAGE_KEY) || "[]") as ConfirmedTransaction[];
  } catch {
    return [];
  }
}

function writeConfirmed(entries: ConfirmedTransaction[]): void {
  if (typeof window !== "undefined") window.localStorage.setItem(CONFIRMED_STORAGE_KEY, JSON.stringify(entries));
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
  confirm(hash: string): void {
    const pending = read().find((item) => item.hash === hash);
    if (!pending) return;
    writeConfirmed([
      ...readConfirmed().filter((item) => item.hash !== hash),
      { hash, method: pending.method, createdAt: pending.createdAt, expected: pending.expected },
    ]);
    write(read().filter((item) => item.hash !== hash));
  },
  confirmed(): ConfirmedTransaction[] {
    return readConfirmed();
  },
};
