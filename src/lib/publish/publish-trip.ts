import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots, trips } from "@/lib/db/schema";
import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";

export type PublishTripResult = {
  tripId: string;
  version: number;
  publishedAt: string | null;
};

export async function publishTrip(tripId: string): Promise<PublishTripResult> {
  const locked = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!locked) throw new Error("Trip not found");

  const nextVersion = locked.publishedVersion + 1;
  const snapshot = await buildSnapshotV1(tripId, nextVersion);

  const [inserted] = await db
    .insert(publishedTripSnapshots)
    .values({
      tripId,
      version: nextVersion,
      jsonData: snapshot,
    })
    .returning({ publishedAt: publishedTripSnapshots.publishedAt });

  await db
    .update(trips)
    .set({ publishedVersion: nextVersion, updatedAt: new Date() })
    .where(eq(trips.id, tripId));

  return {
    tripId,
    version: nextVersion,
    publishedAt: inserted?.publishedAt?.toISOString() ?? null,
  };
}
