import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { tripDays } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripDayForTrip } from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchDaySchema = z.object({
  cityLabel: z.string().trim().min(1).max(200).optional(),
  calendarLabel: z.string().trim().max(50).nullable().optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; dayId: string }> },
) {
  const { inviteCode, dayId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const day = await getTripDayForTrip(trip.id, dayId);
    if (!day) return NextResponse.json({ error: "Day not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchDaySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const [updated] = await db
      .update(tripDays)
      .set({
        cityLabel: parsed.data.cityLabel ?? day.cityLabel,
        calendarLabel:
          parsed.data.calendarLabel !== undefined
            ? parsed.data.calendarLabel
            : day.calendarLabel,
        summary:
          parsed.data.summary !== undefined ? parsed.data.summary : day.summary,
        sortOrder: parsed.data.sortOrder ?? day.sortOrder,
      })
      .where(eq(tripDays.id, dayId))
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; dayId: string }> },
) {
  const { inviteCode, dayId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const day = await getTripDayForTrip(trip.id, dayId);
    if (!day) return NextResponse.json({ error: "Day not found." }, { status: 404 });

    await db.delete(tripDays).where(eq(tripDays.id, dayId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
