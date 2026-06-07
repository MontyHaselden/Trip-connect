import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots, trips } from "@/lib/db/schema";
import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";
import {
  compareSnapshots,
  diffHasChanges,
} from "@/lib/publish/compare-snapshots";
import { analyzeImportGaps } from "@/lib/host/wizard/analyze-import-gaps";
import { publishTrip } from "@/lib/publish/publish-trip";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

export async function maybeAutoPublish(tripId: string) {
  const gaps = await analyzeImportGaps(tripId);
  if (gaps.length) return null;
  const trip = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) return null;

  const nextVersion = trip.publishedVersion + 1;
  const draft = await buildSnapshotV1(tripId, nextVersion);

  if (trip.publishedVersion === 0) {
    if (draft.days.length === 0) return null;
    return publishTrip(tripId);
  }

  const row = await db
    .select({ jsonData: publishedTripSnapshots.jsonData })
    .from(publishedTripSnapshots)
    .where(eq(publishedTripSnapshots.tripId, tripId))
    .orderBy(desc(publishedTripSnapshots.version))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const lastPublished = row?.jsonData as PublishedTripSnapshotV1 | undefined;
  const diff = compareSnapshots(lastPublished ?? null, draft);
  if (!diffHasChanges(diff)) return null;

  return publishTrip(tripId);
}

/** Run auto-publish in the background so edit APIs return immediately. */
export function scheduleAutoPublish(tripId: string) {
  void maybeAutoPublish(tripId).catch(() => null);
}
