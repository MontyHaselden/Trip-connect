"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import { ParticipantForm } from "./ParticipantForm";
import type { RosterGroup, RosterParticipant, RosterRoom } from "./types";

export function ParticipantTable(props: {
  inviteCode: string;
  participants: RosterParticipant[];
  rooms: RosterRoom[];
  groups: RosterGroup[];
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, participants, rooms, groups, onReload, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const [editingId, setEditingId] = useState<string | null>(null);

  const groupNames = (ids: string[]) =>
    ids
      .map((id) => groups.find((g) => g.id === id)?.name)
      .filter(Boolean)
      .join(", ") || "—";

  async function remove(id: string) {
    if (!confirm("Remove this participant?")) return;
    try {
      await hostJson(`${api}/participants/${id}`, { method: "DELETE" });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function quickPatch(
    p: RosterParticipant,
    patch: Partial<{
      roomId: string | null;
      groupIds: string[];
    }>,
  ) {
    try {
      await hostJson(`${api}/participants/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Participants</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Phone numbers are visible to hosts only. Students join with the same phone
        on the join link.
      </p>

      {participants.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600">No participants yet.</p>
      ) : (
        <div className="mt-4 -mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs text-zinc-500">
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 font-medium">App</th>
                <th className="pb-2 pr-3 font-medium">Phone</th>
                <th className="pb-2 pr-3 font-medium">Role</th>
                <th className="pb-2 pr-3 font-medium">Room</th>
                <th className="pb-2 pr-3 font-medium">Groups</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-3 font-medium">{p.fullName}</td>
                  <td className="py-3 pr-3 text-xs text-zinc-500">
                    {p.hasPassword ? "Joined" : "No password"}
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs">{p.phoneNumberE164}</td>
                  <td className="py-3 pr-3 capitalize">{p.role}</td>
                  <td className="py-3 pr-3">
                    <select
                      value={p.roomId ?? ""}
                      onChange={(e) =>
                        quickPatch(p, { roomId: e.target.value || null })
                      }
                      className="h-9 max-w-[120px] rounded-lg border border-zinc-200 px-2 text-xs"
                    >
                      <option value="">—</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.roomName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-3 text-xs text-zinc-600">
                    {groupNames(p.groupIds)}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(p.id)}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingId ? (
        <div className="mt-4">
          <ParticipantForm
            inviteCode={inviteCode}
            participant={participants.find((p) => p.id === editingId)}
            rooms={rooms}
            groups={groups}
            onSaved={() => {
              setEditingId(null);
              onReload();
            }}
            onCancel={() => setEditingId(null)}
            onError={onError}
          />
        </div>
      ) : (
        <div className="mt-4">
          <ParticipantForm
            inviteCode={inviteCode}
            rooms={rooms}
            groups={groups}
            onSaved={onReload}
            onError={onError}
          />
        </div>
      )}
    </section>
  );
}
