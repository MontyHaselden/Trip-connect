import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";
import {
  compareSnapshots,
  diffHasChanges,
} from "@/lib/publish/compare-snapshots";
import { publishTrip } from "@/lib/publish/publish-trip";
import { tripNeedsPublishConfirm } from "@/lib/publish/trip-live";
import { db } from "@/lib/db/client";
import { publishedTripSnapshots } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

const PublishBodySchema = z.object({
  confirm: z.boolean().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;

  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const json = await req.json().catch(() => ({}));
    const parsed = PublishBodySchema.safeParse(json);

    const needsConfirm = await tripNeedsPublishConfirm(trip.id);
    if (needsConfirm) {
      if (!parsed.success || !parsed.data.confirm) {
        return NextResponse.json(
          { error: "Confirm required to publish changes to students." },
          { status: 400 },
        );
      }

      const draft = await buildSnapshotV1(trip.id, trip.publishedVersion + 1);
      let lastPublished: PublishedTripSnapshotV1 | null = null;
      if (trip.publishedVersion > 0) {
        const row = await db
          .select({ jsonData: publishedTripSnapshots.jsonData })
          .from(publishedTripSnapshots)
          .where(eq(publishedTripSnapshots.tripId, trip.id))
          .orderBy(desc(publishedTripSnapshots.version))
          .limit(1)
          .then((rows) => rows[0] ?? null);
        if (row) lastPublished = row.jsonData as PublishedTripSnapshotV1;
      }

      const diff = compareSnapshots(lastPublished, draft);
      if (!diffHasChanges(diff)) {
        return NextResponse.json(
          { error: "Nothing new to publish." },
          { status: 400 },
        );
      }
    }

    const result = await publishTrip(trip.id);
    return NextResponse.json(result);
  } catch (err) {
    return hostApiError(err);
  }
}
