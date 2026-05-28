import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { participants, publishedTripSnapshots, trips } from "@/lib/db/schema";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";
import { filterSnapshotForParticipantV1 } from "@/lib/publish/filter-for-participant";

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() ?? null;
}

export async function HEAD(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const token = getBearerToken(req);
  if (!token) return new NextResponse(null, { status: 401 });

  const { tripId } = await ctx.params;

  const participant = await db
    .select({ id: participants.id, tripId: participants.tripId })
    .from(participants)
    .where(eq(participants.accessToken, token))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!participant || participant.tripId !== tripId) {
    return new NextResponse(null, { status: 401 });
  }

  const meta = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!meta) return new NextResponse(null, { status: 404 });

  if (meta.publishedVersion === 0) {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set("X-Trip-Version", "0");
    return res;
  }

  const snap = await db
    .select({ publishedAt: publishedTripSnapshots.publishedAt })
    .from(publishedTripSnapshots)
    .where(
      and(
        eq(publishedTripSnapshots.tripId, tripId),
        eq(publishedTripSnapshots.version, meta.publishedVersion),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const res = new NextResponse(null, { status: 204 });
  res.headers.set("X-Trip-Version", String(meta.publishedVersion));
  if (snap?.publishedAt) res.headers.set("X-Published-At", snap.publishedAt.toISOString());
  return res;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { tripId } = await ctx.params;

  const participant = await db
    .select({
      id: participants.id,
      tripId: participants.tripId,
    })
    .from(participants)
    .where(eq(participants.accessToken, token))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!participant || participant.tripId !== tripId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const meta = await db
    .select({ publishedVersion: trips.publishedVersion })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!meta) return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  if (meta.publishedVersion === 0) {
    return NextResponse.json(
      { error: "Trip has not been published yet." },
      { status: 404 },
    );
  }

  const snapRow = await db
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

  if (!snapRow) {
    return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  }

  const snapshot = snapRow.jsonData as unknown as PublishedTripSnapshotV1;
  const filtered = filterSnapshotForParticipantV1(snapshot, participant.id);

  const res = NextResponse.json(filtered);
  res.headers.set("X-Trip-Version", String(snapRow.version));
  res.headers.set("X-Published-At", snapRow.publishedAt.toISOString());
  return res;
}

