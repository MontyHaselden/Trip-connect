"use client";

import { useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { legsForGroup } from "@/lib/trip-engine/selectors";
import { legScheduleSummary, legTransportTypeLabel } from "@/lib/host/setup/repair-transport-legs";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

import { AsyncButton } from "../shared/AsyncButton";
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
  const [removingLegId, setRemovingLegId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  function legBucket(legId: string): "intercity" | "outbound" | "return" {
    if (props.graph.intercityLegs.some((x) => x.id === legId)) return "intercity";
    if (props.graph.outboundLegs.some((x) => x.id === legId)) return "outbound";
    return "return";
  }

  async function addLegs(legs: IntercityLegDraft[]) {
    setAdding(true);
    try {
      return await props.onDispatch([
        {
          type: "addClassifiedTransportLegs" as const,
          groupId: props.groupId,
          legs,
        },
      ]);
    } finally {
      setAdding(false);
    }
  }

  async function removeLeg(legId: string) {
    setRemovingLegId(legId);
    try {
      await props.onDispatch([
        {
          type: "removeTransportLeg",
          groupId: props.groupId,
          bucket: legBucket(legId),
          legId,
        },
      ]);
    } finally {
      setRemovingLegId(null);
    }
  }

  async function toggleSurfaceOnly(leg: IntercityLegDraft) {
    await props.onDispatch([
      {
        type: "updateTransportLeg",
        groupId: props.groupId,
        bucket: "intercity",
        legId: leg.id,
        patch: { surfaceOnly: !leg.surfaceOnly },
      },
    ]);
  }

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Transport"
      description="Flights, trains, and intercity legs. Legs can be allocated to the calendar or kept unallocated until the days match."
    >
      <ul className="space-y-2">
        {all.map((leg) => {
          const intercity = leg as IntercityLegDraft;
          const isIntercity = props.graph.intercityLegs.some((x) => x.id === leg.id);
          return (
          <li
            key={leg.id}
            className="rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {legTransportTypeLabel(leg)}
                </span>
                <p className="font-medium text-zinc-900">{legRouteLabel(leg)}</p>
                {isIntercity && intercity.surfaceOnly ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                    Not allocated
                  </span>
                ) : isIntercity ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Allocated
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-zinc-500">{legScheduleSummary(leg)}</p>
              {isIntercity ? (
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={Boolean(intercity.surfaceOnly)}
                    onChange={() => void toggleSurfaceOnly(intercity)}
                    disabled={props.saving}
                    className="rounded border-zinc-300"
                  />
                  Not allocated — keep in transport only (no calendar placement)
                </label>
              ) : null}
            </div>
            <AsyncButton
              loading={removingLegId === leg.id}
              loadingLabel="Removing…"
              onClick={() => void removeLeg(leg.id)}
              disabled={removingLegId !== null && removingLegId !== leg.id}
              className="shrink-0 text-sm text-red-600 hover:text-red-700"
            >
              Delete
            </AsyncButton>
            </div>
          </li>
          );
        })}
        {!all.length ? (
          <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
            No transport legs yet.
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
