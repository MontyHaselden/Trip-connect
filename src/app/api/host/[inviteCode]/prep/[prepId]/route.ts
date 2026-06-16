import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { tomorrowPrepItems } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getPrepForTrip } from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";
import { VisibilityFieldsSchema } from "@/lib/visibility/schemas";
import {
  persistEntityVisibility,
  resolveItemVisibility,
} from "@/lib/visibility/item-visibility";

const PatchPrepSchema = z
  .object({
    text: z.string().trim().min(1).max(500).optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .merge(VisibilityFieldsSchema);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; prepId: string }> },
) {
  const { inviteCode, prepId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const prep = await getPrepForTrip(trip.id, prepId);
    if (!prep) return NextResponse.json({ error: "Prep not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchPrepSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = parsed.data;
    const visibility = resolveItemVisibility({
      visibilityMode: data.visibilityMode ?? prep.visibilityMode,
      targets: data.targets,
    });

    const [updated] = await db
      .update(tomorrowPrepItems)
      .set({
        text: data.text ?? prep.text,
        sortOrder: data.sortOrder ?? prep.sortOrder,
        visibilityMode: visibility.visibilityMode,
      })
      .where(eq(tomorrowPrepItems.id, prepId))
      .returning();

    await persistEntityVisibility(
      trip.id,
      "prep_item",
      prepId,
      visibility.visibilityMode,
      visibility.targets,
    );

    await maybeAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; prepId: string }> },
) {
  const { inviteCode, prepId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const prep = await getPrepForTrip(trip.id, prepId);
    if (!prep) return NextResponse.json({ error: "Prep not found." }, { status: 404 });

    await db.delete(tomorrowPrepItems).where(eq(tomorrowPrepItems.id, prepId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
