"use client";

import { useMemo } from "react";

import {
  buildOverviewNextSteps,
  buildOverviewSummary,
  isTripWelcomeState,
} from "@/lib/host/setup/overview-content";
import { formatTripDateRangeLabel, tripDatesAreUnset } from "@/lib/host/trip-date-display";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { graphToSetupState } from "@/lib/trip-engine/adapters";
import { computeLogisticsPrompts } from "@/lib/trip-engine/logistics-prompts";
import type {
  EngineConflict,
  EngineSectionReadiness,
  EngineWarning,
  ProjectedDay,
  RosterSummary,
  TripEntityGraph,
} from "@/lib/trip-engine/types";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";

import type { TripOsSection } from "../TripOsWorkspace";
import { EditableTripName } from "../shared/EditableTripName";
import { OverviewFinancePanel } from "../finance/OverviewFinancePanel";
import { WelcomeOverview } from "./WelcomeOverview";

const STATUS_LABELS: Record<string, string> = {
  complete: "Complete",
  mostly_complete: "Mostly complete",
  warning: "Needs attention",
  question: "Decision needed",
  conflict: "Conflict",
  idle: "Not started",
  flexible: "Flexible",
  todo: "To do",
  decision: "Decision needed",
};

function readinessLabel(r: EngineSectionReadiness): string {
  if (r.message?.trim()) return r.message.trim();
  return STATUS_LABELS[r.status] ?? r.status.replace(/_/g, " ");
}

export function SmartOverview(props: {
  graph: TripEntityGraph;
  readiness: EngineSectionReadiness[];
  selectedDay: ProjectedDay | null;
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  costLedger?: CostLedgerProjection | null;
  rosterSummary?: RosterSummary;
  onUpdateName: (name: string) => void;
  onNavigateSection?: (section: TripOsSection) => void;
}) {
  const setupState = useMemo(() => graphToSetupState(props.graph), [props.graph]);
  const welcome = useMemo(() => isTripWelcomeState(setupState), [setupState]);
  const summary = useMemo(() => buildOverviewSummary(setupState), [setupState]);
  const suggestions = useMemo(() => buildOverviewNextSteps(setupState), [setupState]);
  const logisticsPrompts = useMemo(
    () => (welcome ? [] : computeLogisticsPrompts(props.graph)),
    [props.graph, welcome],
  );

  const tripBounds = effectiveTripBoundsFromState(setupState);
  const datesLabel = tripDatesAreUnset(tripBounds.startDate, tripBounds.endDate)
    ? "Dates not set yet"
    : formatTripDateRangeLabel(tripBounds.startDate, tripBounds.endDate);

  const metaLine = [
    datesLabel,
    props.graph.basics.timezone,
    props.graph.basics.departureCity ? `from ${props.graph.basics.departureCity}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (welcome) {
    return (
      <WelcomeOverview
        graph={props.graph}
        metaLine={metaLine}
        onUpdateName={props.onUpdateName}
        onNavigateSection={props.onNavigateSection}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-10 py-2">
      <div>
        <p className="text-sm font-medium text-violet-600">Overview</p>
        <EditableTripName
          name={props.graph.basics.name}
          onSave={props.onUpdateName}
          variant="ghost"
          className="mt-2"
        />
        <p className="mt-2 text-sm text-zinc-500">{metaLine}</p>
      </div>

      {summary.length ? (
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            In this trip
          </h3>
          <ul className="space-y-3">
            {summary.map((line) => (
              <li key={line.id} className="flex gap-4 text-sm">
                <span className="w-24 shrink-0 font-medium text-zinc-400">{line.label}</span>
                <span className="min-w-0 text-zinc-800">{line.value}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <OverviewFinancePanel
        costLedger={props.costLedger ?? null}
        roster={props.rosterSummary ?? { participants: [], groups: [], rooms: [] }}
        onNavigateSection={props.onNavigateSection}
      />

      {suggestions.length ? (
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Suggested next
          </h3>
          <ul className="space-y-1">
            {suggestions.map((step) => (
              <li key={step.id}>
                {step.section ? (
                  <button
                    type="button"
                    onClick={() => props.onNavigateSection?.(step.section as TripOsSection)}
                    className="group flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-zinc-50"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-zinc-900">{step.title}</span>
                      <span className="mt-0.5 block text-sm text-zinc-500">{step.detail}</span>
                    </span>
                    <span className="shrink-0 text-zinc-300 group-hover:text-violet-400">→</span>
                  </button>
                ) : (
                  <div className="flex items-start gap-3 px-2 py-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{step.title}</p>
                      <p className="mt-0.5 text-sm text-zinc-500">{step.detail}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-emerald-700">
          Core setup looks good — use the calendar to refine daily plans.
        </p>
      )}

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Sections
        </h3>
        <div className="flex flex-wrap gap-2">
          {props.readiness
            .filter((r) => r.id !== "overview")
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => props.onNavigateSection?.(r.id as TripOsSection)}
                className="rounded-full bg-zinc-100 px-3.5 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-200"
              >
                {r.label}
                <span className="ml-1.5 text-zinc-400">· {readinessLabel(r)}</span>
              </button>
            ))}
        </div>
      </section>

      {logisticsPrompts.length ? (
        <section className="rounded-2xl bg-sky-50/80 px-5 py-4">
          <h3 className="text-sm font-semibold text-sky-900">Logistics</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-sky-800">
            {logisticsPrompts.map((p) => (
              <li key={p.id}>{p.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.selectedDay ? (
        <section className="text-sm text-zinc-700">
          <p className="font-semibold text-zinc-900">Selected — {props.selectedDay.date}</p>
          <p className="mt-1">
            {props.selectedDay.primaryCity || "No city"}
            {props.selectedDay.accommodationLabel
              ? ` · ${props.selectedDay.accommodationLabel}`
              : ""}
          </p>
        </section>
      ) : null}

      {props.conflicts.length ? (
        <section className="rounded-2xl bg-red-50/90 px-5 py-4 text-sm text-red-800">
          <p className="font-semibold text-red-900">Conflicts</p>
          <ul className="mt-2 space-y-1">
            {props.conflicts.map((c) => (
              <li key={c.id}>{c.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.warnings.length ? (
        <section className="rounded-2xl bg-amber-50/80 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold">Notes</p>
          <ul className="mt-2 space-y-1">
            {props.warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {props.graph.publishSummary.publishedVersion > 0 ? (
        <p className="text-sm text-emerald-700">
          Students see v{props.graph.publishSummary.publishedVersion}
        </p>
      ) : (
        <p className="text-sm text-amber-700">
          Not shared with participants yet — use Update participants in the sidebar.
        </p>
      )}
    </div>
  );
}
