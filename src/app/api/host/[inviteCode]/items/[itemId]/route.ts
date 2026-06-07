import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { ACTIVITY_CATEGORIES } from "@/types/activity-category";
import { itineraryItems } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import {
  getItemForTrip,
  normalizeTime,
  validateAudience,
} from "@/lib/host/itinerary-queries";
import { scheduleAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchItemSchema = z.object({
  startTime: z.string().min(1).optional(),
  endTime: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  locationName: z.string().trim().max(200).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  mapQuery: z.string().trim().max(500).nullable().optional(),
  leaveByTime: z.string().nullable().optional(),
  transportNote: z.string().trim().max(500).nullable().optional(),
  bringNote: z.string().trim().max(500).nullable().optional(),
  hostNote: z.string().trim().max(500).nullable().optional(),
  audienceType: z.enum(["everyone", "group", "room", "participant"]).optional(),
  audienceId: z.string().uuid().nullable().optional(),
  category: z.enum(ACTIVITY_CATEGORIES).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; itemId: string }> },
) {
  const { inviteCode, itemId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const item = await getItemForTrip(trip.id, itemId);
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchItemSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = parsed.data;
    const audienceType = data.audienceType ?? item.audienceType;
    const audienceId = await validateAudience(
      trip.id,
      audienceType,
      data.audienceId !== undefined ? data.audienceId : item.audienceId,
    );

    const [updated] = await db
      .update(itineraryItems)
      .set({
        startTime: data.startTime ? normalizeTime(data.startTime) : item.startTime,
        endTime:
          data.endTime !== undefined
            ? data.endTime
              ? normalizeTime(data.endTime)
              : null
            : item.endTime,
        title: data.title ?? item.title,
        locationName:
          data.locationName !== undefined ? data.locationName : item.locationName,
        address: data.address !== undefined ? data.address : item.address,
        mapQuery: data.mapQuery !== undefined ? data.mapQuery : item.mapQuery,
        leaveByTime:
          data.leaveByTime !== undefined
            ? data.leaveByTime
              ? normalizeTime(data.leaveByTime)
              : null
            : item.leaveByTime,
        transportNote:
          data.transportNote !== undefined ? data.transportNote : item.transportNote,
        bringNote: data.bringNote !== undefined ? data.bringNote : item.bringNote,
        hostNote: data.hostNote !== undefined ? data.hostNote : item.hostNote,
        audienceType,
        audienceId,
        category: data.category !== undefined ? data.category : item.category,
        sortOrder: data.sortOrder ?? item.sortOrder,
      })
      .where(eq(itineraryItems.id, itemId))
      .returning();

    scheduleAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; itemId: string }> },
) {
  const { inviteCode, itemId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const item = await getItemForTrip(trip.id, itemId);
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    await db.delete(itineraryItems).where(eq(itineraryItems.id, itemId));
    scheduleAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
