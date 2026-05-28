import { openDB } from "idb";

export type CachedTripMeta = {
  tripId: string;
  version: number;
  publishedAt?: string;
  cachedAt: string;
};

const DB_NAME = "trip-connect";
const DB_VERSION = 1;

const STORE_PUBLISHED = "publishedTrip";
const STORE_META = "meta";

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_PUBLISHED)) {
        db.createObjectStore(STORE_PUBLISHED);
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    },
  });
}

export async function putPublishedTrip(tripId: string, payload: unknown) {
  const db = await getDb();
  await db.put(STORE_PUBLISHED, payload, tripId);
}

export async function getPublishedTrip<T = unknown>(tripId: string): Promise<T | null> {
  const db = await getDb();
  return (await db.get(STORE_PUBLISHED, tripId)) ?? null;
}

export async function putMeta(meta: CachedTripMeta) {
  const db = await getDb();
  await db.put(STORE_META, meta, meta.tripId);
}

export async function getMeta(tripId: string): Promise<CachedTripMeta | null> {
  const db = await getDb();
  return (await db.get(STORE_META, tripId)) ?? null;
}

export async function clearTripCache(tripId: string) {
  const db = await getDb();
  await Promise.all([db.delete(STORE_PUBLISHED, tripId), db.delete(STORE_META, tripId)]);
}

