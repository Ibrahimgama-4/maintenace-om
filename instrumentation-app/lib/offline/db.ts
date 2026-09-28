import { openDB, DBSchema, IDBPDatabase } from "idb";

export interface PendingBreakdown {
  localId: string;
  createdAt: number;
  reportedBy: string;
  equipment_id: string | null;
  location: string;
  fault_description: string;
  alarm_code: string | null;
  priority: string;
  assigned_to: string | null;
  assignment_note: string | null;
}

interface OfflineDB extends DBSchema {
  pending_breakdowns: {
    key: string;
    value: PendingBreakdown;
  };
}

const DB_NAME = "instrumentation-offline";
const STORE = "pending_breakdowns";

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      },
    });
  }
  return dbPromise;
}

/** Notifies any listening UI (e.g. the pending-sync banner) that the queue changed. */
function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pending-breakdowns-changed"));
  }
}

export async function addPendingBreakdown(
  data: Omit<PendingBreakdown, "localId" | "createdAt">
): Promise<PendingBreakdown> {
  const db = await getDB();
  const record: PendingBreakdown = {
    ...data,
    localId: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  await db.put(STORE, record);
  notifyChanged();
  return record;
}

export async function getAllPending(): Promise<PendingBreakdown[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removePending(localId: string) {
  const db = await getDB();
  await db.delete(STORE, localId);
  notifyChanged();
}

export async function countPending(): Promise<number> {
  const db = await getDB();
  return db.count(STORE);
}
