"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { PrepItem } from "./types";

export function PrepForm(props: {
  inviteCode: string;
  dayId: string;
  prep?: PrepItem;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, dayId, prep, onSaved, onCancel, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const [text, setText] = useState(prep?.text ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (prep) {
        await hostJson(`${api}/prep/${prep.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      } else {
        await hostJson(`${api}/days/${dayId}/prep`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
      }
      setText("");
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pack rain jacket, etc."
        className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {prep ? "Update" : "Add"}
      </button>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 px-3 text-sm"
        >
          Cancel
        </button>
      ) : null}
    </form>
  );
}
