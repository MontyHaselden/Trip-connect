"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";
import {
  VisibilityPicker,
  type VisibilityPickerValue,
} from "@/components/host/shared/VisibilityPicker";

import type { PrepItem, RosterSummary } from "./types";

export function PrepForm(props: {
  inviteCode: string;
  dayId: string;
  prep?: PrepItem;
  roster: RosterSummary;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, dayId, prep, roster, onSaved, onCancel, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const [text, setText] = useState(prep?.text ?? "");
  const [visibility, setVisibility] = useState<VisibilityPickerValue>(() => ({
    visibilityMode: prep?.visibilityMode ?? "everyone",
    targets: prep?.targets ?? [],
  }));
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        text: text.trim(),
        visibilityMode: visibility.visibilityMode,
        targets: visibility.visibilityMode === "custom" ? visibility.targets : [],
      };
      if (prep) {
        await hostJson(`${api}/prep/${prep.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await hostJson(`${api}/days/${dayId}/prep`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      setText("");
      setVisibility({ visibilityMode: "everyone", targets: [] });
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pack rain jacket, etc."
        className="h-10 min-w-0 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <VisibilityPicker
        compact
        value={visibility}
        onChange={setVisibility}
        groups={roster.groups}
        participants={roster.participants}
        rooms={roster.rooms}
      />
      <div className="flex gap-2">
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
      </div>
    </form>
  );
}
