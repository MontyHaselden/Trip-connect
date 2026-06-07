import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots, trips } from "@/lib/db/schema";
import { enforceViewerLinks } from "@/lib/plans/enforce-plan";
import { getTripOwnerAccountId } from "@/lib/plans/account-usage";
import { filterSnapshotForViewer } from "@/lib/publish/filter-for-viewer";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ viewerCode: string }> },
) {
  const { viewerCode } = await ctx.params;
  try {
    const trip = await db
      .select({
        id: trips.id,
        viewerGalleryEnabled: trips.viewerGalleryEnabled,
        viewerRoomDetailsEnabled: trips.viewerRoomDetailsEnabled,
        publishedVersion: trips.publishedVersion,
      })
      .from(trips)
      .where(eq(trips.viewerCode, viewerCode))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!trip || trip.publishedVersion < 1) {
      return NextResponse.json({ error: "Trip not available." }, { status: 404 });
    }

    const ownerId = await getTripOwnerAccountId(trip.id);
    if (ownerId) {
      const viewerCheck = await enforceViewerLinks(ownerId);
      if (!viewerCheck.allowed) {
        return NextResponse.json({ error: viewerCheck.hardBlock }, { status: 403 });
      }
    }

    const snapshotRow = await db
      .select({ jsonData: publishedTripSnapshots.jsonData })
      .from(publishedTripSnapshots)
      .where(eq(publishedTripSnapshots.tripId, trip.id))
      .orderBy(desc(publishedTripSnapshots.version))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!snapshotRow) {
      return NextResponse.json({ error: "No published trip." }, { status: 404 });
    }

    const snapshot = snapshotRow.jsonData as PublishedTripSnapshotV1;
    const filtered = filterSnapshotForViewer(snapshot, {
      galleryEnabled: trip.viewerGalleryEnabled,
      roomDetailsEnabled: trip.viewerRoomDetailsEnabled,
    });

    return NextResponse.json({ trip: filtered, viewerCode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed." },
      { status: 500 },
    );
  }
}
