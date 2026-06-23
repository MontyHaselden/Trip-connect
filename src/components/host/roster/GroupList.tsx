"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import { GroupForm } from "./GroupForm";
import type { RosterGroup } from "./types";

export function GroupList(props: {
  inviteCode: string;
  groups: RosterGroup[];
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, groups, onReload, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this group?")) return;
    try {
      await hostJson(`${api}/groups/${id}`, { method: "DELETE" });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Groups</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {groups.map((g) =>
          editingId === g.id ? (
            <li key={g.id}>
              <GroupForm
                inviteCode={inviteCode}
                group={g}
                onSaved={() => {
                  setEditingId(null);
                  onReload();
                }}
                onCancel={() => setEditingId(null)}
                onError={onError}
              />
            </li>
          ) : (
            <li
              key={g.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            >
              <div className="flex-1">
                <p className="font-medium">{g.name}</p>
                <p className="text-xs capitalize text-zinc-500">{g.type}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(g.id)}
                  className="text-xs font-medium"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(g.id)}
                  className="text-xs font-medium text-red-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editingId === null ? (
        <div className="mt-4">
          <GroupForm inviteCode={inviteCode} onSaved={onReload} onError={onError} />
        </div>
      ) : null}
    </section>
  );
}
