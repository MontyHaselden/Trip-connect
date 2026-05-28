"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { PhraseCategory } from "./types";

export function CategoryEditor(props: {
  inviteCode: string;
  category: PhraseCategory;
  canUseAi: boolean;
  onUpdated: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
  onBulkTranslated?: (stats: { updated: number; skipped: number }) => void;
}) {
  const {
    inviteCode,
    category,
    canUseAi,
    onUpdated,
    onDeleted,
    onError,
    onBulkTranslated,
  } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}/phrase-categories`;

  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function translateAll() {
    if (!canUseAi || !category.phrases.length) return;
    if (
      !confirm(
        `Translate all ${category.phrases.length} phrase(s) in "${category.name}" with AI? This overwrites translations and pronunciations.`,
      )
    )
      return;
    setBulkBusy(true);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/phrase-categories/${category.id}/ai/translate-all`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Bulk translate failed");
      onBulkTranslated?.({
        updated: body.updated ?? 0,
        skipped: body.skipped ?? 0,
      });
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Bulk translate failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await hostJson(`${api}/${category.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Delete "${category.name}" and all ${category.phrases.length} phrases in it?`,
      )
    )
      return;
    setSaving(true);
    try {
      await hostJson(`${api}/${category.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Category</h2>
      <label className="mt-3 block">
        <span className="text-sm font-medium">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          Save category
        </button>
        <button
          type="button"
          disabled={saving || bulkBusy || !canUseAi || !category.phrases.length}
          onClick={translateAll}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm font-medium disabled:opacity-50"
        >
          {bulkBusy ? "Translating…" : "Translate all with AI"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={remove}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          Delete category
        </button>
      </div>
    </section>
  );
}
