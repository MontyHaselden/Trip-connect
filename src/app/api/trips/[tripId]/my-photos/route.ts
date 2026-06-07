import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { participants, tripPhotos } from "@/lib/db/schema";

function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() ?? null;
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
      .select({ id: participants.id, tripId: participants.tripId })
      .from(participants)
      .where(eq(participants.accessToken, token))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!participant || participant.tripId !== tripId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const photos = await db
      .select({
        id: tripPhotos.id,
        tripDayId: tripPhotos.tripDayId,
        type: tripPhotos.type,
        imageUrl: tripPhotos.imageUrl,
        thumbnailUrl: tripPhotos.thumbnailUrl,
        uploadedAt: tripPhotos.uploadedAt,
      })
      .from(tripPhotos)
      .where(
        and(
          eq(tripPhotos.tripId, tripId),
          eq(tripPhotos.participantId, participant.id),
          eq(tripPhotos.status, "visible"),
        ),
      )
      .orderBy(asc(tripPhotos.uploadedAt));

    return NextResponse.json({
      photos: photos.map((p) => ({
        ...p,
        uploadedAt: p.uploadedAt.toISOString(),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load photos." },
      { status: 500 },
    );
  }
}
