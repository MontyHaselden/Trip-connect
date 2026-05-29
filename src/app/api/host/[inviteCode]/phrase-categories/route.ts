import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { emergencyPhraseCategories } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { nextCategorySortOrder } from "@/lib/host/phrases-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = CreateCategorySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const sortOrder = await nextCategorySortOrder(trip.id);
    const [created] = await db
      .insert(emergencyPhraseCategories)
      .values({
        tripId: trip.id,
        name: parsed.data.name,
        sortOrder,
      })
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
