"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { legsForGroup } from "@/lib/trip-engine/selectors";
import {
  cityMoveToPlaceholderLeg,
  pendingCityMovesFromCalendar,
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

  const pendingMoves = useMemo(
    () => pendingCityMovesFromCalendar(props.graph, props.groupId),
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
      return await props.onDispatch([
        {
          type: "addClassifiedTransportLegs" as const,
          groupId: props.groupId,
          legs: legsToAdd,
        },
      ]);
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

  function addPlaceholderForMove(move: (typeof pendingMoves)[number]) {
    void props.onDispatch([
      {
        type: "addClassifiedTransportLegs",
        groupId: props.groupId,
        legs: [cityMoveToPlaceholderLeg(move, props.groupId)],
      },
    ]);
  }

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Transport"
      description="Flights and intercity legs live here. When you paint a city change on the calendar (e.g. Kyoto → Tokyo), add the matching leg below."
    >
      {pendingMoves.length ? (
        <TripSoftPanel title="From your calendar">
          <p className="text-xs text-zinc-500">
            These city changes are on the calendar but don&apos;t have a transport leg yet.
          </p>
          <ul className="mt-3 space-y-2">
            {pendingMoves.map((move) => (
              <li
                key={`${move.date}:${move.fromCity}:${move.toCity}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-amber-950">
                    {move.fromCity} → {move.toCity}
                  </p>
                  <p className="text-xs text-amber-800">
                    {DateTime.fromISO(move.date).toFormat("d MMM yyyy")} · How are you getting there?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addPlaceholderForMove(move)}
                  className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-950"
                >
                  Add leg
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
        {!all.length && !pendingMoves.length ? (
          <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
            No transport legs yet. Paint a city change on the calendar or add a flight below.
          </li>
        ) : null}
      </ul>
      <TripSoftPanel title="Add flight">
        <p className="text-xs text-zinc-500">
          Enter departure date and flight number — we&apos;ll look up the schedule. Use &ldquo;Add
          connection leg&rdquo; for multi-leg routes. Open &ldquo;Placeholder flights&rdquo; only if
          lookup fails.
        </p>
        <div className="mt-3">
          <FlightLegQuickForm
            groupId={props.groupId}
            defaultDate={props.selectedDate ?? undefined}
            anchorDate={datePicker.anchorDate}
            saving={adding}
            onSubmit={addLegs}
          />
        </div>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
