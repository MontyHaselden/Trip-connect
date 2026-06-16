import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { rooms } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { nextRoomSortOrder } from "@/lib/host/roster-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateRoomSchema = z.object({
  roomName: z.string().trim().min(1).max(100),
  hotelName: z.string().trim().max(200).nullable().optional(),
  hotelAddress: z.string().trim().max(500).nullable().optional(),
  nearestStation: z.string().trim().max(200).nullable().optional(),
  hotelPhone: z.string().trim().max(50).nullable().optional(),
  nearestStationNotes: z.string().trim().max(500).nullable().optional(),
  nearestBusStopName: z.string().trim().max(200).nullable().optional(),
  routeNotesToAccommodation: z.string().trim().max(1000).nullable().optional(),
  staticMapUrl: z.string().trim().max(2000).nullable().optional(),
  mapsUrl: z.string().trim().max(2000).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = CreateRoomSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const sortOrder = await nextRoomSortOrder(trip.id);
    const [created] = await db
      .insert(rooms)
      .values({
        tripId: trip.id,
        roomName: parsed.data.roomName,
        hotelName: parsed.data.hotelName ?? null,
        hotelAddress: parsed.data.hotelAddress ?? null,
        nearestStation: parsed.data.nearestStation ?? null,
        hotelPhone: parsed.data.hotelPhone ?? null,
        nearestStationNotes: parsed.data.nearestStationNotes ?? null,
        nearestBusStopName: parsed.data.nearestBusStopName ?? null,
        routeNotesToAccommodation: parsed.data.routeNotesToAccommodation ?? null,
        staticMapUrl: parsed.data.staticMapUrl ?? null,
        mapsUrl: parsed.data.mapsUrl ?? null,
        notes: parsed.data.notes ?? null,
        sortOrder,
      })
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
