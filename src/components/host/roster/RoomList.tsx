"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import { RoomForm } from "./RoomForm";
import type { RosterRoom } from "./types";

export function RoomList(props: {
  inviteCode: string;
  rooms: RosterRoom[];
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, rooms, onReload, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(id: string) {
    if (!confirm("Delete this room? Participant assignments will be cleared."))
      return;
    try {
      await hostJson(`${api}/rooms/${id}`, { method: "DELETE" });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Rooms</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {rooms.map((r) =>
          editingId === r.id ? (
            <li key={r.id}>
              <RoomForm
                inviteCode={inviteCode}
                room={r}
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
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{r.roomName}</p>
                {r.hotelName ? <p className="text-zinc-600">{r.hotelName}</p> : null}
                {r.nearestStation ? (
                  <p className="text-xs text-zinc-500">Near {r.nearestStation}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(r.id)}
                  className="text-xs font-medium"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
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
          <RoomForm inviteCode={inviteCode} onSaved={onReload} onError={onError} />
        </div>
      ) : null}
    </section>
  );
}
