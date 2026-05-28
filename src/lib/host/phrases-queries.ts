import { and, asc, eq, max } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  emergencyPhraseCategories,
  emergencyPhrases,
} from "@/lib/db/schema";
import { DEFAULT_PHRASE_CATEGORIES } from "@/lib/phrases/default-phrases";

export async function loadPhraseTree(tripId: string) {
  const categories = await db
    .select()
    .from(emergencyPhraseCategories)
    .where(eq(emergencyPhraseCategories.tripId, tripId))
    .orderBy(asc(emergencyPhraseCategories.sortOrder));

  const phrases = await db
    .select()
    .from(emergencyPhrases)
    .where(eq(emergencyPhrases.tripId, tripId))
    .orderBy(asc(emergencyPhrases.categoryId), asc(emergencyPhrases.sortOrder));

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      phrases: phrases
        .filter((p) => p.categoryId === c.id)
        .map((p) => ({
          id: p.id,
          categoryId: p.categoryId,
          englishText: p.englishText,
          translatedText: p.translatedText,
          pronunciation: p.pronunciation,
          notes: p.notes,
          source: p.source,
          sortOrder: p.sortOrder,
        })),
    })),
  };
}

export async function getCategoryForTrip(tripId: string, categoryId: string) {
  const row = await db
    .select()
    .from(emergencyPhraseCategories)
    .where(
      and(
        eq(emergencyPhraseCategories.id, categoryId),
        eq(emergencyPhraseCategories.tripId, tripId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row;
}

export async function getPhraseForTrip(tripId: string, phraseId: string) {
  const row = await db
    .select()
    .from(emergencyPhrases)
    .where(
      and(eq(emergencyPhrases.id, phraseId), eq(emergencyPhrases.tripId, tripId)),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row;
}

export async function nextCategorySortOrder(tripId: string) {
  const row = await db
    .select({ v: max(emergencyPhraseCategories.sortOrder) })
    .from(emergencyPhraseCategories)
    .where(eq(emergencyPhraseCategories.tripId, tripId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function nextPhraseSortOrder(categoryId: string) {
  const row = await db
    .select({ v: max(emergencyPhrases.sortOrder) })
    .from(emergencyPhrases)
    .where(eq(emergencyPhrases.categoryId, categoryId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function seedDefaultPhrasesIfEmpty(tripId: string) {
  const existing = await db
    .select({ id: emergencyPhraseCategories.id })
    .from(emergencyPhraseCategories)
    .where(eq(emergencyPhraseCategories.tripId, tripId))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    return { created: false, message: "Trip already has phrase categories." };
  }

  let categorySort = 0;
  for (const cat of DEFAULT_PHRASE_CATEGORIES) {
    const [insertedCategory] = await db
      .insert(emergencyPhraseCategories)
      .values({
        tripId,
        name: cat.name,
        sortOrder: categorySort++,
      })
      .returning();

    if (!insertedCategory) continue;

    let phraseSort = 0;
    for (const p of cat.phrases) {
      await db.insert(emergencyPhrases).values({
        tripId,
        categoryId: insertedCategory.id,
        englishText: p.english,
        translatedText: p.translated,
        pronunciation: p.pronunciation ?? null,
        source: "default",
        sortOrder: phraseSort++,
      });
    }
  }

  return { created: true };
}
