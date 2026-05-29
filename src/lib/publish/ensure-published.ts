import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export async function ensureTripPublishedIfReady(tripId: string): Promise<number> {
  const meta = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!meta) return 0;
  if (meta.publishedVersion > 0) return meta.publishedVersion;

  await maybeAutoPublish(tripId);

  const after = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return after?.publishedVersion ?? 0;
}
