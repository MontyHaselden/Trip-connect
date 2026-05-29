import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { tripDays } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import {
  isDateInRange,
  nextDaySortOrder,
} from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cityLabel: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = CreateDaySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const { date, cityLabel, summary } = parsed.data;
    if (!isDateInRange(date, trip.startDate, trip.endDate)) {
      return NextResponse.json(
        { error: "Date must be within trip start and end dates." },
        { status: 400 },
      );
    }

    const existing = await db
      .select({ id: tripDays.id })
      .from(tripDays)
      .where(and(eq(tripDays.tripId, trip.id), eq(tripDays.date, date)))
      .limit(1)
      .then((rows) => rows[0]);
    if (existing) {
      return NextResponse.json(
        { error: "A day with this date already exists." },
        { status: 400 },
      );
    }

    const sortOrder = await nextDaySortOrder(trip.id);
    const [created] = await db
      .insert(tripDays)
      .values({
        tripId: trip.id,
        date,
        cityLabel,
        summary: summary ?? null,
        sortOrder,
      })
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
