import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";

export async function ensureTripPublishedIfReady(tripId: string): Promise<number> {
  const meta = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return meta?.publishedVersion ?? 0;
}
