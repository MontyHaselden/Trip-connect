import { NextResponse } from "next/server";

import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import {
  applyPhraseTranslations,
  loadPhrasesForCategoryInTrip,
} from "@/lib/ai/apply-phrase-translations";
import { translatePhrasesBatch } from "@/lib/ai/phrase-translate";
import { hostApiError } from "@/lib/host/api-errors";
import { getCategoryForTrip, loadPhraseTree } from "@/lib/host/phrases-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export async function POST(
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

    const phrases = await loadPhrasesForCategoryInTrip(trip.id, categoryId);
    if (!phrases.length) {
      return NextResponse.json(
        { error: "No phrases with English text in this category." },
        { status: 400 },
      );
    }

    try {
      const batch = await translatePhrasesBatch({
        phrases,
        context: {
          destinationLanguage: trip.destinationLanguage ?? "",
          destinationCountry: trip.destinationCountry,
          tripName: trip.name,
        },
      });

      const stats = await applyPhraseTranslations(batch.results);
      await maybeAutoPublish(trip.id);
      const tree = await loadPhraseTree(trip.id);

      return NextResponse.json({
        ...stats,
        tree,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Translation failed.";
      if (msg.includes("OPENAI_API_KEY") || msg.includes("destination language")) {
        const status = msg.includes("OPENAI_API_KEY") ? 503 : 400;
        return NextResponse.json({ error: msg }, { status });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  } catch (err) {
    return hostApiError(err);
  }
}
