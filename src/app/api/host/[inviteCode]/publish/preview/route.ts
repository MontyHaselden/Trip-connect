import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots } from "@/lib/db/schema";
import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";
import {
  compareSnapshots,
  diffHasChanges,
  diffSummaryCounts,
} from "@/lib/publish/compare-snapshots";
import { tripNeedsPublishConfirm } from "@/lib/publish/trip-live";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const needsPublishConfirm = await tripNeedsPublishConfirm(trip.id);

    const draft = await buildSnapshotV1(trip.id, trip.publishedVersion + 1);

    let lastPublished: PublishedTripSnapshotV1 | null = null;
    let lastPublishedAt: string | null = null;

    if (trip.publishedVersion > 0) {
      const row = await db
        .select({
          jsonData: publishedTripSnapshots.jsonData,
          publishedAt: publishedTripSnapshots.publishedAt,
        })
        .from(publishedTripSnapshots)
        .where(eq(publishedTripSnapshots.tripId, trip.id))
        .orderBy(desc(publishedTripSnapshots.version))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (row) {
        lastPublished = row.jsonData as PublishedTripSnapshotV1;
        lastPublishedAt = row.publishedAt.toISOString();
      }
    }

    const diff = compareSnapshots(lastPublished, draft);
    const hasChanges = diffHasChanges(diff);

    return NextResponse.json({
      needsPublishConfirm,
      publishedVersion: trip.publishedVersion,
      lastPublishedAt,
      hasChanges,
      diff,
      summary: diffSummaryCounts(diff),
    });
  } catch (err) {
    return hostApiError(err);
  }
}
