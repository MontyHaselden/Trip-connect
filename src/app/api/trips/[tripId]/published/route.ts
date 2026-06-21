import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { participants } from "@/lib/db/schema";
import { getPublishedForParticipant } from "@/lib/publish/get-published-for-participant";
import { eq } from "drizzle-orm";

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() ?? null;
}

async function loadParticipant(token: string, tripId: string) {
  return db
    .select({ id: participants.id, tripId: participants.tripId })
    .from(participants)
    .where(eq(participants.accessToken, token))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .then((row) => (row && row.tripId === tripId ? row : null));
}

function noPayloadResponse(pendingHostUpdate: boolean) {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("X-Trip-Version", "0");
  if (pendingHostUpdate) {
    res.headers.set("X-Pending-Host-Update", "1");
  }
  return res;
}

export async function HEAD(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  try {
    const token = getBearerToken(req);
    if (!token) return new NextResponse(null, { status: 401 });

    const { tripId } = await ctx.params;
    const participant = await loadParticipant(token, tripId);
    if (!participant) return new NextResponse(null, { status: 401 });

    const result = await getPublishedForParticipant(tripId, participant.id);
    if (!result) {
      return noPayloadResponse(true);
    }

    const res = new NextResponse(null, { status: 204 });
    res.headers.set("X-Trip-Version", String(result.version));
    res.headers.set("X-Published-At", result.publishedAt.toISOString());
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
    const participant = await loadParticipant(token, tripId);
    if (!participant) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const result = await getPublishedForParticipant(tripId, participant.id);

    if (!result) {
      return NextResponse.json(
        {
          error: "pending_host_update",
          message:
            "Your organiser has not shared the trip with you yet. Ask them to tap Update participants in Trip OS.",
        },
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
