"use client";

import { useMemo, useState } from "react";

import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { hasScheduledReturnTransport } from "@/lib/host/wizard/transport-day-placement";
import {
  formatLocationStayRange,
  locationRangesFromContent,
} from "@/lib/host/setup/location-range-display";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { AsyncButton } from "../shared/AsyncButton";
import { TripDateInput } from "../shared/TripDateInput";
import { tripDatePickerContext } from "../shared/trip-date-picker";

export function LocationsSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  selectedDate: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [location, setLocation] = useState("");
  const [rangeStart, setRangeStart] = useState(props.selectedDate ?? "");
  const [rangeEnd, setRangeEnd] = useState(props.selectedDate ?? "");
  const days = props.graph.dayPlacesByGroupId[props.groupId] ?? [];
  const bounds = effectiveTripBoundsFromState(props.graph);
  const datePicker = tripDatePickerContext(props.graph, props.selectedDate);

  const locationRanges = useMemo(
    () =>
      locationRangesFromContent({
        days,
        tripStart: bounds.startDate,
        tripEnd: bounds.endDate,
        departureCity: props.graph.basics.departureCity,
        returnCity: props.graph.basics.returnCity,
        hasReturnTransport: hasScheduledReturnTransport(props.graph, {
          endDate: bounds.endDate,
          returnCity: props.graph.basics.returnCity,
        }),
        accommodationStays: props.graph.accommodationStays,
        outboundLegs: props.graph.outboundLegs,
        returnLegs: props.graph.returnLegs,
        intercityLegs: props.graph.intercityLegs,
      }),
    [
      days,
      bounds.startDate,
      bounds.endDate,
      props.graph,
      props.graph.basics.departureCity,
      props.graph.basics.returnCity,
    ],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Locations</h2>
        <p className="text-sm text-zinc-600">Advanced / bulk edit — paint city ranges via commands.</p>
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
        {locationRanges.map((range) => (
          <li key={`${range.location}-${range.startDate}-${range.endDate}`} className="rounded border border-zinc-100 px-2 py-1">
            {formatLocationStayRange(range)}
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Paint location range</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City name" className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" />
          <TripDateInput
            value={rangeStart}
            onChange={setRangeStart}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <TripDateInput
            value={rangeEnd}
            onChange={setRangeEnd}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <AsyncButton
          onClick={() =>
            void props.onDispatch([
              {
                type: "paintDayRange",
                groupId: props.groupId,
                rangeStart,
                rangeEnd: rangeEnd || rangeStart,
                location,
              },
            ])
          }
          loading={props.saving}
          loadingLabel="Painting…"
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Paint range
        </AsyncButton>
      </div>
    </div>
  );
}
