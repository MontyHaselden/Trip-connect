"use client";

import { hostJson } from "@/components/host/shared/host-fetch";

import { PrepForm } from "./PrepForm";
import type { RosterSummary, TripDay } from "./types";

export function PrepList(props: {
  inviteCode: string;
  day: TripDay;
  roster: RosterSummary;
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, day, roster, editingId, onEdit, onReload, onError } = props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;
  const prep = [...day.prep].sort((a, b) => a.sortOrder - b.sortOrder);

  async function move(row: (typeof prep)[0], dir: -1 | 1) {
    const idx = prep.findIndex((p) => p.id === row.id);
    const swap = prep[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        hostJson(`${api}/prep/${row.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: swap.sortOrder }),
        }),
        hostJson(`${api}/prep/${swap.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: row.sortOrder }),
        }),
      ]);
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this prep line?")) return;
    try {
      await hostJson(`${api}/prep/${id}`, { method: "DELETE" });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Tomorrow prep</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Shown to students on this day as preparation for the next day.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {prep.map((row, idx) => (
          <li key={row.id} className="rounded-xl border border-zinc-200 px-3 py-2">
            {editingId === row.id ? (
              <PrepForm
                inviteCode={inviteCode}
                dayId={day.id}
                prep={row}
                roster={roster}
                onSaved={() => {
                  onEdit(null);
                  onReload();
                }}
                onCancel={() => onEdit(null)}
                onError={onError}
              />
            ) : (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{row.text}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => move(row, -1)}
                    className="text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={idx === prep.length - 1}
                    onClick={() => move(row, 1)}
                    className="text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(row.id)}
                    className="text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row.id)}
                    className="text-xs font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editingId === null ? (
        <div className="mt-3">
          <PrepForm
            inviteCode={inviteCode}
            dayId={day.id}
            roster={roster}
            onSaved={onReload}
            onError={onError}
          />
        </div>
      ) : null}
    </section>
  );
}
