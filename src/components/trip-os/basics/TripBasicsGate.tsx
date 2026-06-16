"use client";

import { useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

const TIMEZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
  "Asia/Tokyo",
  "Asia/Bangkok",
  "Europe/London",
  "America/Los_Angeles",
  "UTC",
];

/** Optional trip metadata — dates are set on the calendar, not here. */
export function TripBasicsGate(props: {
  graph: TripEntityGraph;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const { basics } = props.graph;
  const [name, setName] = useState(basics.name || "New trip");
  const [timezone, setTimezone] = useState(basics.timezone || "Australia/Sydney");
  const [departureCity, setDepartureCity] = useState(basics.departureCity || "");
  const [returnCity, setReturnCity] = useState(basics.returnCity || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const ok = await props.onDispatch([
      {
        type: "updateBasics",
        basics: {
          name: name.trim() || "New trip",
          timezone,
          departureCity: departureCity.trim(),
          returnCity: returnCity.trim(),
        },
      },
    ]);
    if (!ok) setError("Save failed — try again.");
    setSaving(false);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div>
        <h2 className="text-xl font-semibold">Trip basics</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Name and home cities — set trip dates by painting on the calendar.
        </p>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium">Trip name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Timezone</span>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Departure city (optional)</span>
            <input
              value={departureCity}
              onChange={(e) => setDepartureCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Return city (optional)</span>
            <input
              value={returnCity}
              onChange={(e) => setReturnCity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
