import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots, trips } from "@/lib/db/schema";
import { requireHostSessionTripId } from "@/lib/auth/host-session";
import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;

  try {
    const sessionTripId = requireHostSessionTripId();

    const trip = await db
      .select({
        id: trips.id,
        inviteCode: trips.inviteCode,
        publishedVersion: trips.publishedVersion,
      })
      .from(trips)
      .where(eq(trips.id, sessionTripId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!trip || trip.inviteCode !== inviteCode) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const result = await db.transaction(async (tx) => {
      const locked = await tx
        .select({ publishedVersion: trips.publishedVersion })
        .from(trips)
        .where(eq(trips.id, trip.id))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!locked) throw new Error("Trip not found");

      const nextVersion = locked.publishedVersion + 1;
      const snapshot = await buildSnapshotV1(trip.id, nextVersion, tx as typeof db);

      const [inserted] = await tx
        .insert(publishedTripSnapshots)
        .values({
          tripId: trip.id,
          version: nextVersion,
          jsonData: snapshot,
        })
        .returning({ publishedAt: publishedTripSnapshots.publishedAt });

      await tx
        .update(trips)
        .set({ publishedVersion: nextVersion, updatedAt: new Date() })
        .where(eq(trips.id, trip.id));

      return { tripId: trip.id, version: nextVersion, publishedAt: inserted?.publishedAt };
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Publish failed.";
    const status = msg === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

