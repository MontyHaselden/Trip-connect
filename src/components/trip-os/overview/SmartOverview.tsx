"use client";

import { useMemo } from "react";

import { formatTripDateRangeLabel } from "@/lib/host/trip-date-display";
import { computeLogisticsPrompts } from "@/lib/trip-engine/logistics-prompts";
import type {
  EngineConflict,
  EngineSectionReadiness,
  EngineWarning,
  ProjectedDay,
  TripEntityGraph,
} from "@/lib/trip-engine/types";

export function SmartOverview(props: {
  graph: TripEntityGraph;
  readiness: EngineSectionReadiness[];
  selectedDay: ProjectedDay | null;
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  onUpdateName: (name: string) => void;
  onNavigateSection?: (section: string) => void;
}) {
  const logisticsPrompts = useMemo(
    () => computeLogisticsPrompts(props.graph),
    [props.graph],
  );

  const readinessById = new Map(props.readiness.map((r) => [r.id, r]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Smart overview</h2>
        <p className="text-sm text-zinc-600">
          {formatTripDateRangeLabel(props.graph.basics.startDate, props.graph.basics.endDate)} ·{" "}
          {props.graph.basics.timezone}
          {props.graph.basics.departureCity
            ? ` · from ${props.graph.basics.departureCity}`
            : ""}
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

      <div className="grid gap-2 sm:grid-cols-2">
        {props.readiness
          .filter((r) => r.id !== "overview")
          .map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => props.onNavigateSection?.(r.id)}
              className="rounded-lg border border-zinc-200 p-3 text-left hover:border-zinc-300"
            >
              <p className="text-sm font-medium">{r.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{r.message || r.status}</p>
            </button>
          ))}
      </div>

      {logisticsPrompts.length ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="text-sm font-semibold text-blue-900">Logistics & bookings</h3>
          <ul className="mt-2 space-y-2 text-sm text-blue-800">
            {logisticsPrompts.map((p) => (
              <li key={p.id} className="flex items-start gap-2">
                <span>{p.severity === "warning" ? "⚠" : "ℹ"}</span>
                <span>{p.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.selectedDay ? (
        <div className="rounded-xl border border-zinc-200 p-4">
          <h3 className="text-sm font-semibold">Selected day — {props.selectedDay.date}</h3>
          <p className="mt-2 text-sm text-zinc-700">
            {props.selectedDay.primaryCity || "No city"}
            {props.selectedDay.accommodationLabel
              ? ` · ${props.selectedDay.accommodationLabel}`
              : ""}
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

      {readinessById.get("publish")?.status === "complete" ? (
        <p className="text-sm text-emerald-700">
          Published v{props.graph.publishSummary.publishedVersion} — student app reads published
          snapshot from this graph.
        </p>
      ) : null}
    </div>
  );
}
