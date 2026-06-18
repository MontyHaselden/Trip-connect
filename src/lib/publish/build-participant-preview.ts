import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots, trips } from "@/lib/db/schema";
import { reconcileTransportItineraryItems } from "@/lib/host/import/transport-itinerary-reconcile";
import { loadTripGraph } from "@/lib/trip-engine/load-trip-graph";
import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";
import {
  compareSnapshots,
  diffHasChanges,
} from "@/lib/publish/compare-snapshots";
import {
  filterSnapshotForParticipantV1,
  type ParticipantFilteredTripV1,
} from "@/lib/publish/filter-for-participant";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

export type ParticipantPreviewForHost = {
  participantId: string;
  payload: ParticipantFilteredTripV1;
  source: "draft";
  version: number;
  publishedVersion: number;
  publishedAt: string | null;
  liveForStudents: boolean;
  staleVsPublished: boolean;
};

export function computeParticipantPreviewMeta(params: {
  publishedVersion: number;
  staleVsPublished: boolean;
}): Pick<ParticipantPreviewForHost, "liveForStudents" | "staleVsPublished"> {
  const { publishedVersion, staleVsPublished } = params;
  return {
    staleVsPublished,
    liveForStudents: publishedVersion > 0 && !staleVsPublished,
  };
}

async function loadLatestPublishedSnapshot(tripId: string) {
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

export async function buildParticipantPreviewForHost(
  tripId: string,
  participantId: string,
): Promise<ParticipantPreviewForHost> {
  const trip = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) throw new Error("Trip not found");

  const publishedVersion = trip.publishedVersion;
  const draftVersion = Math.max(1, publishedVersion + 1);

  const graph = await loadTripGraph(tripId);
  if (graph) {
    await reconcileTransportItineraryItems(tripId, graph);
  }

  const draftSnapshot = await buildSnapshotV1(tripId, draftVersion);

  if (!draftSnapshot.participants.some((p) => p.id === participantId)) {
    throw new Error("Participant not found in trip snapshot");
  }

  const payload = filterSnapshotForParticipantV1(draftSnapshot, participantId);

  const publishedRow = await loadLatestPublishedSnapshot(tripId);
  const lastPublished = publishedRow?.jsonData as PublishedTripSnapshotV1 | undefined;

  let staleVsPublished = false;
  if (publishedVersion > 0 && lastPublished) {
    const diff = compareSnapshots(lastPublished, draftSnapshot);
    staleVsPublished = diffHasChanges(diff);
  } else if (publishedVersion === 0 && draftSnapshot.days.length > 0) {
    staleVsPublished = true;
  }

  const meta = computeParticipantPreviewMeta({ publishedVersion, staleVsPublished });

  return {
    participantId,
    payload,
    source: "draft",
    version: draftVersion,
    publishedVersion,
    publishedAt: publishedRow?.publishedAt?.toISOString() ?? null,
    ...meta,
  };
}
