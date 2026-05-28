"use client";

import { useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";

import type { TripDay } from "./types";

export function DayEditor(props: {
  inviteCode: string;
  day: TripDay;
  tripStart: string;
  tripEnd: string;
  onUpdated: () => void;
  onDeleted: () => void;
  onError: (msg: string) => void;
}) {
  const { inviteCode, day, tripStart, tripEnd, onUpdated, onDeleted, onError } =
    props;
  const api = `/api/host/${encodeURIComponent(inviteCode)}`;

  const [cityLabel, setCityLabel] = useState(day.cityLabel);
  const [summary, setSummary] = useState(day.summary ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await hostJson(`${api}/days/${day.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cityLabel: cityLabel.trim(),
          summary: summary.trim() || null,
        }),
      });
      onUpdated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${day.date} and all items/prep for this day?`)) return;
    setSaving(true);
    try {
      await hostJson(`${api}/days/${day.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold">
        {day.date}
        <span className="ml-2 text-sm font-normal text-zinc-500">
          ({tripStart} – {tripEnd})
        </span>
      </h2>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-sm font-medium">City label</span>
          <input
            value={cityLabel}
            onChange={(e) => setCityLabel(e.target.value)}
            placeholder="Tokyo → Kyoto"
            className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Summary (optional)</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          Save day
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={remove}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 px-4 text-sm font-medium text-red-700 disabled:opacity-50"
        >
          Delete day
        </button>
      </div>
    </section>
  );
}
