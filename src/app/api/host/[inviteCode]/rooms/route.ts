import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { rooms } from "@/lib/db/schema";
import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { nextRoomSortOrder } from "@/lib/host/roster-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateRoomSchema = z.object({
  roomName: z.string().trim().min(1).max(100),
  hotelName: z.string().trim().max(200).nullable().optional(),
  hotelAddress: z.string().trim().max(500).nullable().optional(),
  nearestStation: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
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
