"use client";

import { hostJson } from "@/components/host/shared/host-fetch";

import { ItemForm } from "./ItemForm";
import type { ItineraryItem, RosterSummary, TripDay } from "./types";
import { timeToInput } from "./types";

export function ItemList(props: {
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
  const items = [...day.items].sort((a, b) => a.sortOrder - b.sortOrder);

  async function move(item: ItineraryItem, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === item.id);
    const swap = items[idx + dir];
    if (!swap) return;
    try {
      await Promise.all([
        hostJson(`${api}/items/${item.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: swap.sortOrder }),
        }),
        hostJson(`${api}/items/${swap.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sortOrder: item.sortOrder }),
        }),
      ]);
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this itinerary item?")) return;
    try {
      await hostJson(`${api}/items/${id}`, { method: "DELETE" });
      onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">Itinerary items</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No items for this day yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item, idx) =>
            editingId === item.id ? (
              <li key={item.id}>
                <ItemForm
                  inviteCode={inviteCode}
                  dayId={day.id}
                  roster={roster}
                  item={item}
                  onSaved={() => {
                    onEdit(null);
                    onReload();
                  }}
                  onCancel={() => onEdit(null)}
                  onError={onError}
                />
              </li>
            ) : (
              <li
                key={item.id}
                className="rounded-xl border border-zinc-200 px-4 py-3 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {timeToInput(item.startTime)}
                      {item.endTime ? ` – ${timeToInput(item.endTime)}` : ""}
                      {" · "}
                      {item.title}
                    </p>
                    {item.locationName ? (
                      <p className="text-zinc-600">{item.locationName}</p>
                    ) : null}
                    <p className="text-xs text-zinc-500">
                      {item.audienceType === "everyone"
                        ? "Everyone"
                        : `${item.audienceType}: ${item.audienceId}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => move(item, -1)}
                      className="text-xs text-zinc-600 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => move(item, 1)}
                      className="text-xs text-zinc-600 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(item.id)}
                    className="text-xs font-medium text-zinc-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="text-xs font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {editingId === null ? (
        <div className="mt-4">
          <ItemForm
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
