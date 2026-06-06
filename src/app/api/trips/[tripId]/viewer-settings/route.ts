import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

const BodySchema = z.object({
  viewerGalleryEnabled: z.boolean().optional(),
  viewerRoomDetailsEnabled: z.boolean().optional(),
  studentGalleryEnabled: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const existing = await getTripByIdForHost(hostId, tripId);
    if (!existing) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    await db
      .update(trips)
      .set({
        ...(parsed.data.viewerGalleryEnabled !== undefined
          ? { viewerGalleryEnabled: parsed.data.viewerGalleryEnabled }
          : {}),
        ...(parsed.data.viewerRoomDetailsEnabled !== undefined
          ? { viewerRoomDetailsEnabled: parsed.data.viewerRoomDetailsEnabled }
          : {}),
        ...(parsed.data.studentGalleryEnabled !== undefined
          ? { studentGalleryEnabled: parsed.data.studentGalleryEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId));

    const trip = await getTripByIdForHost(hostId, tripId);
    return NextResponse.json({ trip });
  } catch (err) {
    return hostApiError(err);
  }
}
