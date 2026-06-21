import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots } from "@/lib/db/schema";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";
import {
  filterSnapshotForParticipantV1,
  type ParticipantFilteredTripV1,
} from "@/lib/publish/filter-for-participant";

async function loadLatestSnapshot(tripId: string) {
  return db
    .select({
      jsonData: publishedTripSnapshots.jsonData,
      version: publishedTripSnapshots.version,
      publishedAt: publishedTripSnapshots.publishedAt,
    })
    .from(publishedTripSnapshots)
    .where(eq(publishedTripSnapshots.tripId, tripId))
    .orderBy(desc(publishedTripSnapshots.version))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

function participantInSnapshot(
  snapshot: PublishedTripSnapshotV1,
  participantId: string,
) {
  return snapshot.participants.some((p) => p.id === participantId);
}

export async function getPublishedForParticipant(
  tripId: string,
  participantId: string,
): Promise<{
  payload: ParticipantFilteredTripV1;
  version: number;
  publishedAt: Date;
} | null> {
  const snapRow = await loadLatestSnapshot(tripId);
  if (!snapRow) return null;

  const snapshot = snapRow.jsonData as unknown as PublishedTripSnapshotV1;
  if (!participantInSnapshot(snapshot, participantId)) {
    return null;
  }

  return {
    payload: filterSnapshotForParticipantV1(snapshot, participantId),
    version: snapRow.version,
    publishedAt: snapRow.publishedAt,
  };
}
