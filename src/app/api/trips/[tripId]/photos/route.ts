import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripPhotos } from "@/lib/db/schema";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const photos = await db
      .select({
        id: tripPhotos.id,
        tripDayId: tripPhotos.tripDayId,
        type: tripPhotos.type,
        imageUrl: tripPhotos.imageUrl,
        status: tripPhotos.status,
        uploadedAt: tripPhotos.uploadedAt,
      })
      .from(tripPhotos)
      .where(eq(tripPhotos.tripId, tripId))
      .orderBy(desc(tripPhotos.uploadedAt));

    return NextResponse.json({
      photos: photos.map((p) => ({
        ...p,
        uploadedAt: p.uploadedAt.toISOString(),
      })),
    });
  } catch (err) {
    return hostApiError(err);
  }
}
