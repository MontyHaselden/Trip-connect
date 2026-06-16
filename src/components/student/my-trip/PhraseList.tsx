"use client";

export function PhraseList(props: {
  categories: Array<{ id: string; name: string; sortOrder: number }>;
  phrases: Array<{
    id: string;
    categoryId: string;
    englishText: string;
    translatedText: string;
    pronunciation: string | null;
    notes: string | null;
    sortOrder: number;
  }>;
}) {
  const { categories, phrases } = props;

  if (!categories.length) {
    return (
      <section className="student-card">
        <h2 className="text-base font-bold text-[var(--student-text)]">Emergency phrases</h2>
        <p className="mt-2 text-sm text-[var(--student-text-muted)]">No phrases added yet.</p>
      </section>
    );
  }

  const phrasesByCategory = new Map<string, typeof phrases>();
  for (const p of phrases) {
    const arr = phrasesByCategory.get(p.categoryId) ?? [];
    arr.push(p);
    phrasesByCategory.set(p.categoryId, arr);
  }
  for (const arr of phrasesByCategory.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="student-card">
      <h2 className="text-base font-bold text-[var(--student-text)]">Emergency phrases</h2>
      <div className="mt-3 space-y-4">
        {sortedCats.map((cat) => {
          const list = phrasesByCategory.get(cat.id) ?? [];
          if (!list.length) return null;
          return (
            <div
              key={cat.id}
              className="rounded-xl border border-[var(--student-line)] bg-[var(--student-bg)] p-4"
            >
              <div className="text-sm font-medium text-[var(--student-text)]">{cat.name}</div>
              <div className="mt-3 space-y-3">
                {list.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg bg-[var(--student-surface)] px-3 py-2"
                  >
                    <div className="text-sm font-medium text-[var(--student-text)]">
                      {p.englishText}
                    </div>
                    <div className="mt-1 text-sm text-[var(--student-text)]">
                      {p.translatedText}
                    </div>
                    {p.pronunciation ? (
                      <div className="mt-1 text-xs text-[var(--student-text-muted)]">
                        {p.pronunciation}
                      </div>
                    ) : null}
                    {p.notes ? (
                      <div className="mt-1 text-xs text-[var(--student-text-muted)]">
                        {p.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
