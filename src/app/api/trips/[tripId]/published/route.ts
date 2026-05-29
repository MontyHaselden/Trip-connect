import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { participants, publishedTripSnapshots } from "@/lib/db/schema";
import { ensureTripPublishedIfReady } from "@/lib/publish/ensure-published";
import { getPublishedForParticipant } from "@/lib/publish/get-published-for-participant";

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
  try {
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

    const publishedVersion = await ensureTripPublishedIfReady(tripId);

    if (publishedVersion === 0) {
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
          eq(publishedTripSnapshots.version, publishedVersion),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const res = new NextResponse(null, { status: 204 });
    res.headers.set("X-Trip-Version", String(publishedVersion));
    if (snap?.publishedAt) {
      res.headers.set("X-Published-At", snap.publishedAt.toISOString());
    }
    return res;
  } catch (err) {
    console.error("published HEAD failed", err);
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

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

    const result = await getPublishedForParticipant(tripId, participant.id);

    if (!result) {
      return NextResponse.json(
        { error: "Trip has not been published yet." },
        { status: 404 },
      );
    }

    const res = NextResponse.json(result.payload);
    res.headers.set("X-Trip-Version", String(result.version));
    res.headers.set("X-Published-At", result.publishedAt.toISOString());
    return res;
  } catch (err) {
    console.error("published GET failed", err);
    const message =
      err instanceof Error ? err.message : "Failed to load published trip.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
