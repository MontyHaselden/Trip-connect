import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripPhotos } from "@/lib/db/schema";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ photoId: string }> },
) {
  const { photoId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const photo = await db
      .select()
      .from(tripPhotos)
      .where(eq(tripPhotos.id, photoId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!photo) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const trip = await getTripByIdForHost(hostId, photo.tripId);
    if (!trip) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    await db
      .update(tripPhotos)
      .set({ status: "hidden", deletedAt: new Date() })
      .where(eq(tripPhotos.id, photoId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
