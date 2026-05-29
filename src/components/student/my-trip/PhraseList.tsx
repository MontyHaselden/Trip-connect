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
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Emergency phrases</h2>
        <p className="mt-2 text-sm text-zinc-600">No phrases added yet.</p>
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Emergency phrases</h2>
      <div className="mt-3 space-y-4">
        {sortedCats.map((cat) => {
          const list = phrasesByCategory.get(cat.id) ?? [];
          if (!list.length) return null;
          return (
            <div key={cat.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-medium text-zinc-900">{cat.name}</div>
              <div className="mt-3 space-y-3">
                {list.map((p) => (
                  <div key={p.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                    <div className="text-sm font-medium text-zinc-900">{p.englishText}</div>
                    <div className="mt-1 text-sm text-zinc-800">{p.translatedText}</div>
                    {p.pronunciation ? (
                      <div className="mt-1 text-xs text-zinc-600">{p.pronunciation}</div>
                    ) : null}
                    {p.notes ? (
                      <div className="mt-1 text-xs text-zinc-600">{p.notes}</div>
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

