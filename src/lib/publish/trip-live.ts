import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { participants, trips } from "@/lib/db/schema";

export async function tripNeedsPublishConfirm(tripId: string): Promise<boolean> {
  const [tripRow, participantCount] = await Promise.all([
    db
      .select({ publishedVersion: trips.publishedVersion })
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ n: count() })
      .from(participants)
      .where(eq(participants.tripId, tripId))
      .then((rows) => Number(rows[0]?.n ?? 0)),
  ]);

  if (!tripRow) return false;
  if (tripRow.publishedVersion > 0) return true;
  if (participantCount > 0) return true;
  return false;
}
