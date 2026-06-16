"use client";

import type { TripEntityGraph, EngineConflict, EngineWarning } from "@/lib/trip-engine/types";
import type { ProjectedDay } from "@/lib/trip-engine/types";

export function OverviewSection(props: {
  graph: TripEntityGraph;
  selectedDay: ProjectedDay | null;
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  onUpdateName: (name: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-sm text-zinc-600">
          {props.graph.basics.startDate} → {props.graph.basics.endDate} · {props.graph.basics.timezone}
        </p>
      </div>
      <label className="block">
        <span className="text-sm font-medium">Trip name</span>
        <input
          value={props.graph.basics.name}
          onChange={(e) => props.onUpdateName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      {props.selectedDay ? (
        <div className="rounded-xl border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold">Selected day — {props.selectedDay.date}</h3>
          <p className="mt-2 text-sm text-zinc-700">
            {props.selectedDay.primaryCity || "No city"}
            {props.selectedDay.accommodationLabel ? ` · ${props.selectedDay.accommodationLabel}` : ""}
          </p>
          {props.selectedDay.activities.length ? (
            <ul className="mt-2 text-sm text-zinc-600">
              {props.selectedDay.activities.map((a) => (
                <li key={a.id}>★ {a.title}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {props.conflicts.length ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-800">Conflicts</h3>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {props.conflicts.map((c) => (
              <li key={c.id}>{c.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {props.warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Warnings</h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {props.warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
