import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { rooms } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getRoomForTrip } from "@/lib/host/roster-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchRoomSchema = z.object({
  roomName: z.string().trim().min(1).max(100).optional(),
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
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; roomId: string }> },
) {
  const { inviteCode, roomId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const room = await getRoomForTrip(trip.id, roomId);
    if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchRoomSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const [updated] = await db
      .update(rooms)
      .set({
        roomName: parsed.data.roomName ?? room.roomName,
        hotelName:
          parsed.data.hotelName !== undefined ? parsed.data.hotelName : room.hotelName,
        hotelAddress:
          parsed.data.hotelAddress !== undefined
            ? parsed.data.hotelAddress
            : room.hotelAddress,
        nearestStation:
          parsed.data.nearestStation !== undefined
            ? parsed.data.nearestStation
            : room.nearestStation,
        hotelPhone:
          parsed.data.hotelPhone !== undefined ? parsed.data.hotelPhone : room.hotelPhone,
        nearestStationNotes:
          parsed.data.nearestStationNotes !== undefined
            ? parsed.data.nearestStationNotes
            : room.nearestStationNotes,
        nearestBusStopName:
          parsed.data.nearestBusStopName !== undefined
            ? parsed.data.nearestBusStopName
            : room.nearestBusStopName,
        routeNotesToAccommodation:
          parsed.data.routeNotesToAccommodation !== undefined
            ? parsed.data.routeNotesToAccommodation
            : room.routeNotesToAccommodation,
        staticMapUrl:
          parsed.data.staticMapUrl !== undefined
            ? parsed.data.staticMapUrl
            : room.staticMapUrl,
        mapsUrl:
          parsed.data.mapsUrl !== undefined ? parsed.data.mapsUrl : room.mapsUrl,
        notes: parsed.data.notes !== undefined ? parsed.data.notes : room.notes,
        sortOrder: parsed.data.sortOrder ?? room.sortOrder,
      })
      .where(eq(rooms.id, roomId))
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; roomId: string }> },
) {
  const { inviteCode, roomId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const room = await getRoomForTrip(trip.id, roomId);
    if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

    await db.delete(rooms).where(eq(rooms.id, roomId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
