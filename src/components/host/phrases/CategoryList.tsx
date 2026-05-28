"use client";

import type { PhraseCategory } from "./types";

export function CategoryList(props: {
  categories: PhraseCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { categories, selectedId, onSelect } = props;
  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  if (!sorted.length) {
    return (
      <p className="text-sm text-zinc-600">
        No categories yet. Import defaults or add a category below.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => onSelect(c.id)}
            className={[
              "w-full rounded-xl border px-4 py-3 text-left text-sm",
              selectedId === c.id
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:bg-zinc-50",
            ].join(" ")}
          >
            <span className="font-medium">{c.name}</span>
            <span
              className={
                selectedId === c.id ? "text-zinc-300" : "text-zinc-500"
              }
            >
              {" "}
              · {c.phrases.length} phrase{c.phrases.length === 1 ? "" : "s"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
