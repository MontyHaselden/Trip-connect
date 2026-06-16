export type EmergencyHelpPhrase = {
  englishText: string;
  translatedText: string;
  pronunciation: string | null;
};

export function resolveEmergencyHelpPhrase(
  categories: Array<{ id: string; name: string }>,
  phrases: Array<{
    categoryId: string;
    englishText: string;
    translatedText: string;
    pronunciation: string | null;
    sortOrder: number;
  }>,
): EmergencyHelpPhrase | null {
  if (!phrases.length) return null;

  const helpCategory = categories.find((c) =>
    c.name.toLowerCase().includes("help"),
  );

  const pool = helpCategory
    ? phrases.filter((p) => p.categoryId === helpCategory.id)
    : phrases;

  const sorted = [...pool].sort((a, b) => a.sortOrder - b.sortOrder);

  const preferred =
    sorted.find((p) =>
      /school group|call my teacher/i.test(p.englishText),
    ) ?? sorted[0];

  if (!preferred) return null;

  return {
    englishText: preferred.englishText,
    translatedText: preferred.translatedText,
    pronunciation: preferred.pronunciation,
  };
}
