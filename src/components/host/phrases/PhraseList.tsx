"use client";

import { hostJson } from "@/components/host/shared/host-fetch";

import { PhraseForm } from "./PhraseForm";
import type { PhraseCategory } from "./types";

export function PhraseList(props: {
  inviteCode: string;
  category: PhraseCategory;
  canUseAi: boolean;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, category, canUseAi, editingId, onEdit, onReload, onError } =
    props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const phrases = [...category.phrases].sort((a, b) => a.sortOrder - b.sortOrder);

  async function move(phrase: (typeof phrases)[0], dir: -1 | 1) {
    const idx = phrases.findIndex((p) => p.id === phrase.id);
    const swap = phrases[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        hostJson(`${api}/phrases/${phrase.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: swap.sortOrder }),
        }),
        hostJson(`${api}/phrases/${swap.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: phrase.sortOrder }),
        }),
      ]);
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this phrase?")) return;
    try {
      await hostJson(`${api}/phrases/${id}`, { method: "DELETE" });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Phrases in {category.name}</h2>
      {phrases.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No phrases in this category yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {phrases.map((p, idx) =>
            editingId === p.id ? (
              <li key={p.id}>
                <PhraseForm
                  inviteCode={inviteCode}
                  categoryId={category.id}
                  phrase={p}
                  canUseAi={canUseAi}
                  onSaved={() => {
                    onEdit(null);
                    onReload();
                  }}
                  onCancel={() => onEdit(null)}
                  onError={onError}
                />
              </li>
            ) : (
              <li
                key={p.id}
                className="rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.englishText}</p>
                    <p className="text-zinc-800">{p.translatedText}</p>
                    {p.pronunciation ? (
                      <p className="text-xs text-zinc-600">{p.pronunciation}</p>
                    ) : null}
                    <p className="mt-1 text-xs capitalize text-zinc-500">
                      {p.source}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => move(p, -1)}
                      className="text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === phrases.length - 1}
                      onClick={() => move(p, 1)}
                      className="text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(p.id)}
                    className="text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="text-xs font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {editingId === null ? (
        <div className="mt-4">
          <PhraseForm
            inviteCode={inviteCode}
            categoryId={category.id}
            canUseAi={canUseAi}
            onSaved={onReload}
            onError={onError}
          />
        </div>
      ) : null}
    </section>
  );
}
