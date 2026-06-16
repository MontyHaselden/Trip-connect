"use client";

import { useMemo } from "react";

import {
  buildOverviewNextSteps,
  buildOverviewSummary,
} from "@/lib/host/setup/overview-content";
import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import type { SetupSectionId, TripSetupState } from "@/lib/host/setup/types";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import {
  formatTripDateRangeLabel,
  tripDatesAreUnset,
} from "@/lib/host/trip-date-display";

export function SetupOverviewSection(props: {
  state: TripSetupState;
  onGoToSection: (id: SetupSectionId) => void;
}) {
  const { state, onGoToSection } = props;
  const summary = useMemo(() => buildOverviewSummary(state), [state]);
  const nextSteps = useMemo(() => buildOverviewNextSteps(state), [state]);

  const displayName = tripNameNeedsAttention(state.basics.name)
    ? "Untitled trip"
    : state.basics.name.trim();
  const tripBounds = effectiveTripBoundsFromState(state);
  const datesLabel = tripDatesAreUnset(tripBounds.startDate, tripBounds.endDate)
    ? null
    : formatTripDateRangeLabel(tripBounds.startDate, tripBounds.endDate);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-6 py-6">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Overview</p>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">{displayName}</h2>
          {datesLabel ? <p className="text-sm text-zinc-500">{datesLabel}</p> : null}
          {tripNameNeedsAttention(state.basics.name) ? (
            <p className="text-sm text-amber-800">Name this trip in the header to continue saving.</p>
          ) : null}
        </header>

        {summary.length ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900">In this trip</h3>
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
              {summary.map((line) => (
                <li key={line.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
                  <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {line.label}
                  </span>
                  <span className="min-w-0 text-sm text-zinc-800">{line.value}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {nextSteps.length ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900">What&apos;s next?</h3>
            <ul className="space-y-2">
              {nextSteps.map((step) => (
                <li key={step.id}>
                  {step.section ? (
                    <button
                      type="button"
                      onClick={() => onGoToSection(step.section!)}
                      className="flex w-full flex-col gap-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Suggested
                      </span>
                      <span className="text-sm font-semibold text-zinc-900">{step.title}</span>
                      <span className="text-sm text-zinc-600">{step.detail}</span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Suggested
                      </span>
                      <p className="mt-1 text-sm font-semibold text-zinc-900">{step.title}</p>
                      <p className="mt-0.5 text-sm text-zinc-600">{step.detail}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            Core setup looks good — use the calendar to refine daily plans or open other sections.
          </p>
        )}

        <p className="text-xs text-zinc-400">
          Select days on the calendar to assign locations, accommodation, transport, and activities.
        </p>
      </div>
    </div>
  );
}
