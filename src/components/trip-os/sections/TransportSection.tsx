"use client";

import { useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { legsForGroup } from "@/lib/trip-engine/selectors";
import {
  cityMoveToPlaceholderLeg,
  pendingNeedLabel,
  pendingTransportNeedsFromCalendar,
  type PendingTransportNeed,
} from "@/lib/trip-engine/pending-city-moves";
import { legScheduleSummary, legTransportTypeLabel } from "@/lib/host/setup/repair-transport-legs";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

import { FlightLegQuickForm } from "../shared/FlightLegQuickForm";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import { tripDatePickerContext } from "../shared/trip-date-picker";

function legRouteLabel(leg: TransportLegDraft | IntercityLegDraft): string {
  const ic = leg as IntercityLegDraft;
  if (ic.intercityFromCity && ic.intercityToCity) {
    return `${ic.intercityFromCity} → ${ic.intercityToCity}`;
  }
  return `${leg.fromCity} → ${leg.toCity}`;
}

export function TransportSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  selectedDate?: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const datePicker = tripDatePickerContext(props.graph, props.selectedDate);
  const legs = legsForGroup(props.graph, props.groupId);
  const all = [...legs.outbound, ...legs.return, ...legs.intercity];
  const [adding, setAdding] = useState(false);
  const [flightPrefill, setFlightPrefill] = useState<{
    date: string;
    from?: string;
    to?: string;
  } | null>(null);
  const flightFormRef = useRef<HTMLDivElement | null>(null);

  const pendingNeeds = useMemo(
    () => pendingTransportNeedsFromCalendar(props.graph, props.groupId),
    [props.graph, props.groupId],
  );

  function legBucket(legId: string): "intercity" | "outbound" | "return" {
    if (props.graph.intercityLegs.some((x) => x.id === legId)) return "intercity";
    if (props.graph.outboundLegs.some((x) => x.id === legId)) return "outbound";
    return "return";
  }

  async function addLegs(legsToAdd: IntercityLegDraft[]) {
    setAdding(true);
    try {
      const ok = await props.onDispatch([
        {
          type: "addClassifiedTransportLegs" as const,
          groupId: props.groupId,
          legs: legsToAdd,
        },
      ]);
      if (ok) setFlightPrefill(null);
      return ok;
    } finally {
      setAdding(false);
    }
  }

  function removeLeg(legId: string) {
    void props.onDispatch([
      {
        type: "removeTransportLeg",
        groupId: props.groupId,
        bucket: legBucket(legId),
        legId,
      },
    ]);
  }

  function addPlaceholderForMove(need: PendingTransportNeed) {
    void props.onDispatch([
      {
        type: "addClassifiedTransportLegs",
        groupId: props.groupId,
        legs: [cityMoveToPlaceholderLeg(need, props.groupId, need.kind)],
      },
    ]);
  }

  function openFlightFormForNeed(need: PendingTransportNeed) {
    setFlightPrefill({
      date: need.date,
      from: need.fromCity,
      to: need.toCity,
    });
    flightFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function needActionLabel(need: PendingTransportNeed): string {
    return need.kind === "intercity" ? "Add leg" : "Add flight";
  }

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Transport"
      description="Add outbound and return flights with a flight number — they appear in Finance. Intercity legs match city changes on the calendar."
    >
      {pendingNeeds.length ? (
        <TripSoftPanel title="From your calendar">
          <p className="text-xs text-zinc-500">
            These routes are on the calendar but don&apos;t have transport yet. Outbound and return
            flights use the flight form below and sync to Finance.
          </p>
          <ul className="mt-3 space-y-2">
            {pendingNeeds.map((need) => (
              <li
                key={`${need.kind}:${need.date}:${need.fromCity}:${need.toCity}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
              >
                <div className="min-w-0 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    {pendingNeedLabel(need)}
                  </p>
                  <p className="font-medium text-amber-950">
                    {need.fromCity} → {need.toCity}
                  </p>
                  <p className="text-xs text-amber-800">
                    {DateTime.fromISO(need.date).toFormat("d MMM yyyy")}
                    {need.kind === "intercity"
                      ? " · How are you getting there?"
                      : " · Enter flight number below"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    need.kind === "intercity"
                      ? addPlaceholderForMove(need)
                      : openFlightFormForNeed(need)
                  }
                  className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950"
                >
                  {needActionLabel(need)}
                </button>
              </li>
            ))}
          </ul>
        </TripSoftPanel>
      ) : null}

      <ul className="space-y-2">
        {all.map((leg) => (
          <li key={leg.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {legTransportTypeLabel(leg)}
                  </span>
                  <p className="font-medium text-zinc-900">{legRouteLabel(leg)}</p>
                </div>
                <p className="mt-0.5 text-sm text-zinc-500">{legScheduleSummary(leg)}</p>
              </div>
              <button
                type="button"
                onClick={() => removeLeg(leg.id)}
                className="shrink-0 text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {!all.length && !pendingNeeds.length ? (
          <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
            No transport legs yet. Paint a city change on the calendar or add a flight below.
          </li>
        ) : null}
      </ul>
      <div ref={flightFormRef}>
        <TripSoftPanel title="Add flight">
          <p className="text-xs text-zinc-500">
            Enter departure date and flight number — we&apos;ll look up the schedule. Outbound and
            return flights are classified automatically and appear in the Finance transport section.
          </p>
          <div className="mt-3">
            <FlightLegQuickForm
              key={`${flightPrefill?.date ?? "default"}:${flightPrefill?.from ?? ""}:${flightPrefill?.to ?? ""}`}
              groupId={props.groupId}
              defaultDate={props.selectedDate ?? undefined}
              anchorDate={datePicker.anchorDate}
              prefillRoute={flightPrefill}
              saving={adding}
              onSubmit={addLegs}
            />
          </div>
        </TripSoftPanel>
      </div>
    </TripSectionShell>
  );
}
