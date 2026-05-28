"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { RosterGroup } from "./types";

export function GroupForm(props: {
  inviteCode: string;
  group?: RosterGroup;
  onSaved: () => void;
  onCancel?: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, group, onSaved, onCancel, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;

  const [name, setName] = useState(group?.name ?? "");
  const [type, setType] = useState<RosterGroup["type"]>(group?.type ?? "activity");
  const [description, setDescription] = useState(group?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        description: description.trim() || null,
      };
      if (group) {
        await hostJson(`${api}/groups/${group.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await hostJson(`${api}/groups`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <p className="text-sm font-medium">{group ? "Edit group" : "Add group"}</p>
      <input
        required
        placeholder="Group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as RosterGroup["type"])}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      >
        <option value="activity">Activity</option>
        <option value="bus">Bus</option>
        <option value="week">Week</option>
        <option value="other">Other</option>
      </select>
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : group ? "Update" : "Add group"}
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
