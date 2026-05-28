import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { emergencyPhrases } from "@/lib/db/schema";

export async function applyPhraseTranslations(
  updates: Array<{
    id: string;
    translatedText: string;
    pronunciation: string;
  }>,
) {
  let updated = 0;
  for (const row of updates) {
    const result = await db
      .update(emergencyPhrases)
      .set({
        translatedText: row.translatedText,
        pronunciation: row.pronunciation,
        source: "ai",
      })
      .where(eq(emergencyPhrases.id, row.id))
      .returning({ id: emergencyPhrases.id });

    if (result.length && result[0]?.id) updated++;
  }

  const skipped = updates.length - updated;
  return { updated, skipped };
}

export async function loadPhrasesForCategory(categoryId: string) {
  return db
    .select({
      id: emergencyPhrases.id,
      englishText: emergencyPhrases.englishText,
    })
    .from(emergencyPhrases)
    .where(eq(emergencyPhrases.categoryId, categoryId))
    .then((rows) =>
      rows.filter((r) => r.englishText.trim().length > 0),
    );
}

export async function loadPhrasesForCategoryInTrip(
  tripId: string,
  categoryId: string,
) {
  return db
    .select({
      id: emergencyPhrases.id,
      englishText: emergencyPhrases.englishText,
    })
    .from(emergencyPhrases)
    .where(
      and(
        eq(emergencyPhrases.tripId, tripId),
        eq(emergencyPhrases.categoryId, categoryId),
      ),
    )
    .then((rows) =>
      rows.filter((r) => r.englishText.trim().length > 0),
    );
}
