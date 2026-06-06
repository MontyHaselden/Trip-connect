import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { ACTIVITY_CATEGORIES } from "@/types/activity-category";
import { itineraryItems } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import {
  getTripDayForTrip,
  nextItemSortOrder,
  normalizeTime,
  validateAudience,
} from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateItemSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  locationName: z.string().trim().max(200).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  mapQuery: z.string().trim().max(500).nullable().optional(),
  leaveByTime: z.string().nullable().optional(),
  transportNote: z.string().trim().max(500).nullable().optional(),
  bringNote: z.string().trim().max(500).nullable().optional(),
  hostNote: z.string().trim().max(500).nullable().optional(),
  audienceType: z.enum(["everyone", "group", "room", "participant"]),
  audienceId: z.string().uuid().nullable().optional(),
  category: z.enum(ACTIVITY_CATEGORIES).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; dayId: string }> },
) {
  const { inviteCode, dayId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const day = await getTripDayForTrip(trip.id, dayId);
    if (!day) return NextResponse.json({ error: "Day not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = CreateItemSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = parsed.data;
    const audienceId = await validateAudience(
      trip.id,
      data.audienceType,
      data.audienceId,
    );

    const sortOrder = await nextItemSortOrder(dayId);
    const [created] = await db
      .insert(itineraryItems)
      .values({
        tripId: trip.id,
        tripDayId: dayId,
        startTime: normalizeTime(data.startTime),
        endTime: data.endTime ? normalizeTime(data.endTime) : null,
        title: data.title,
        locationName: data.locationName ?? null,
        address: data.address ?? null,
        mapQuery: data.mapQuery ?? null,
        leaveByTime: data.leaveByTime ? normalizeTime(data.leaveByTime) : null,
        transportNote: data.transportNote ?? null,
        bringNote: data.bringNote ?? null,
        hostNote: data.hostNote ?? null,
        audienceType: data.audienceType,
        audienceId,
        category: data.category ?? null,
        sortOrder,
      })
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
