"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { PhraseItem } from "./types";

export function PhraseForm(props: {
  inviteCode: string;
  categoryId: string;
  phrase?: PhraseItem;
  canUseAi: boolean;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, categoryId, phrase, canUseAi, onSaved, onCancel, onError } =
    props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const editing = Boolean(phrase);

  const [englishText, setEnglishText] = useState(phrase?.englishText ?? "");
  const [translatedText, setTranslatedText] = useState(
    phrase?.translatedText ?? "",
  );
  const [pronunciation, setPronunciation] = useState(
    phrase?.pronunciation ?? "",
  );
  const [notes, setNotes] = useState(phrase?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  async function translateWithAi() {
    const english = englishText.trim();
    if (!english || !canUseAi) return;
    setTranslating(true);
    try {
      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/phrases/ai/translate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ englishText: english }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Translation failed");
      setTranslatedText(body.translatedText ?? "");
      setPronunciation(body.pronunciation ?? "");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      englishText: englishText.trim(),
      translatedText: translatedText.trim(),
      pronunciation: pronunciation.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      if (editing && phrase) {
        await hostJson(`${api}/phrases/${phrase.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await hostJson(`${api}/phrase-categories/${categoryId}/phrases`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (!editing) {
        setEnglishText("");
        setTranslatedText("");
        setPronunciation("");
        setNotes("");
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4"
    >
      <p className="text-sm font-medium">{editing ? "Edit phrase" : "Add phrase"}</p>
      <div className="flex gap-2">
        <input
          required
          placeholder="English"
          value={englishText}
          onChange={(e) => setEnglishText(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-sm"
        />
        <button
          type="button"
          disabled={!canUseAi || !englishText.trim() || translating}
          onClick={translateWithAi}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium disabled:opacity-50"
        >
          {translating ? "…" : "AI translate"}
        </button>
      </div>
      <input
        required
        placeholder="Translation"
        value={translatedText}
        onChange={(e) => setTranslatedText(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        placeholder="Pronunciation (optional)"
        value={pronunciation}
        onChange={(e) => setPronunciation(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <input
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Update" : "Add"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-4 text-sm"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
