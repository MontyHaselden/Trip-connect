import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { emergencyPhrases } from "@/lib/db/schema";
import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getPhraseForTrip } from "@/lib/host/phrases-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const PatchPhraseSchema = z.object({
  englishText: z.string().trim().min(1).max(500).optional(),
  translatedText: z.string().trim().min(1).max(500).optional(),
  pronunciation: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; phraseId: string }> },
) {
  const { inviteCode, phraseId } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const phrase = await getPhraseForTrip(trip.id, phraseId);
    if (!phrase) {
      return NextResponse.json({ error: "Phrase not found." }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = PatchPhraseSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const [updated] = await db
      .update(emergencyPhrases)
      .set({
        englishText: parsed.data.englishText ?? phrase.englishText,
        translatedText: parsed.data.translatedText ?? phrase.translatedText,
        pronunciation:
          parsed.data.pronunciation !== undefined
            ? parsed.data.pronunciation
            : phrase.pronunciation,
        notes: parsed.data.notes !== undefined ? parsed.data.notes : phrase.notes,
        sortOrder: parsed.data.sortOrder ?? phrase.sortOrder,
        source: "host",
      })
      .where(eq(emergencyPhrases.id, phraseId))
      .returning();

    await maybeAutoPublish(trip.id);
    return NextResponse.json(updated);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; phraseId: string }> },
) {
  const { inviteCode, phraseId } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const phrase = await getPhraseForTrip(trip.id, phraseId);
    if (!phrase) {
      return NextResponse.json({ error: "Phrase not found." }, { status: 404 });
    }

    await db.delete(emergencyPhrases).where(eq(emergencyPhrases.id, phraseId));
    await maybeAutoPublish(trip.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
