import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { tomorrowPrepItems } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripDayForTrip, nextPrepSortOrder } from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";
import { VisibilityFieldsSchema } from "@/lib/visibility/schemas";
import {
  persistEntityVisibility,
  resolveItemVisibility,
} from "@/lib/visibility/item-visibility";

const CreatePrepSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
  })
  .merge(VisibilityFieldsSchema);

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
    const parsed = CreatePrepSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const sortOrder = await nextPrepSortOrder(dayId);
    const visibility = resolveItemVisibility(parsed.data);
    const [created] = await db
      .insert(tomorrowPrepItems)
      .values({
        tripId: trip.id,
        tripDayId: dayId,
        text: parsed.data.text,
        sortOrder,
        visibilityMode: visibility.visibilityMode,
      })
      .returning();

    await persistEntityVisibility(
      trip.id,
      "prep_item",
      created!.id,
      visibility.visibilityMode,
      visibility.targets,
    );

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
