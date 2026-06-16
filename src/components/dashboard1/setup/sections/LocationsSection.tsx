"use client";

import { useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

export function LocationsSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  selectedDate: string | null;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [location, setLocation] = useState("");
  const [rangeStart, setRangeStart] = useState(props.selectedDate ?? "");
  const [rangeEnd, setRangeEnd] = useState(props.selectedDate ?? "");

  const days = props.graph.dayPlacesByGroupId[props.groupId] ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Locations</h2>
        <p className="text-sm text-zinc-600">Paint city ranges on the calendar via commands.</p>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
        {days
          .filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim())
          .map((d) => (
            <li key={d.date} className="rounded border border-zinc-100 px-2 py-1">
              {d.date}: {d.primaryCity}
              {d.secondaryCity ? ` / ${d.secondaryCity}` : ""}
            </li>
          ))}
      </ul>
      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Paint location range</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City name" className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
          <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
          <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <button
          type="button"
          onClick={() =>
            props.onDispatch([
              {
                type: "paintDayRange",
                groupId: props.groupId,
                rangeStart,
                rangeEnd: rangeEnd || rangeStart,
                location,
              },
            ])
          }
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Paint range
        </button>
      </div>
    </div>
  );
}
