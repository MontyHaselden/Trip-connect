import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { emergencyPhrases } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import {
  getCategoryForTrip,
  nextPhraseSortOrder,
} from "@/lib/host/phrases-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreatePhraseSchema = z.object({
  englishText: z.string().trim().min(1).max(500),
  translatedText: z.string().trim().min(1).max(500),
  pronunciation: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function POST(
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
    const parsed = CreatePhraseSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const sortOrder = await nextPhraseSortOrder(categoryId);
    const [created] = await db
      .insert(emergencyPhrases)
      .values({
        tripId: trip.id,
        categoryId,
        englishText: parsed.data.englishText,
        translatedText: parsed.data.translatedText,
        pronunciation: parsed.data.pronunciation ?? null,
        notes: parsed.data.notes ?? null,
        source: "host",
        sortOrder,
      })
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
