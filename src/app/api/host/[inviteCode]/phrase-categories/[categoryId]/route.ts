import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { emergencyPhraseCategories } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getCategoryForTrip } from "@/lib/host/phrases-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; categoryId: string }> },
) {
  const { inviteCode, categoryId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const category = await getCategoryForTrip(trip.id, categoryId);
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = PatchCategorySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const [updated] = await db
      .update(emergencyPhraseCategories)
      .set({
        name: parsed.data.name ?? category.name,
        sortOrder: parsed.data.sortOrder ?? category.sortOrder,
      })
      .where(eq(emergencyPhraseCategories.id, categoryId))
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; categoryId: string }> },
) {
  const { inviteCode, categoryId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const category = await getCategoryForTrip(trip.id, categoryId);
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    await db
      .delete(emergencyPhraseCategories)
      .where(eq(emergencyPhraseCategories.id, categoryId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
