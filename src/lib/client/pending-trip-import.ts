import { openDB } from "idb";

const DB_NAME = "trip-connect-imports";
const STORE = "pending";

type PendingTripImport = {
  tripId: string;
  file: Blob;
  fileName: string;
  instructions: string | null;
  savedAt: string;
};

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "tripId" });
      }
    },
  });
}

export async function savePendingTripImport(params: {
  tripId: string;
  file: File;
  instructions: string | null;
}) {
  const db = await getDb();
  const record: PendingTripImport = {
    tripId: params.tripId,
    file: params.file,
    fileName: params.file.name,
    instructions: params.instructions,
    savedAt: new Date().toISOString(),
  };
  await db.put(STORE, record);
}

export async function peekPendingTripImport(
  tripId: string,
): Promise<PendingTripImport | null> {
  const db = await getDb();
  const record = (await db.get(STORE, tripId)) as PendingTripImport | undefined;
  return record ?? null;
}

export async function clearPendingTripImport(tripId: string) {
  const db = await getDb();
  await db.delete(STORE, tripId);
}
