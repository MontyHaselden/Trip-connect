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
import { TripInput, tripFieldClass } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripListRow, TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
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
    [days, bounds.startDate, bounds.endDate, props.graph],
  );

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Locations"
      description="Paint city ranges via commands — same engine as the calendar."
    >
      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
        {locationRanges.map((range) => (
          <TripListRow key={`${range.location}-${range.startDate}-${range.endDate}`}>
            {formatLocationStayRange(range)}
          </TripListRow>
        ))}
      </ul>
      <TripSoftPanel title="Paint location range">
        <div className="grid gap-2 sm:grid-cols-2">
          <TripInput
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City name"
            className="sm:col-span-2"
          />
          <TripDateInput
            value={rangeStart}
            onChange={setRangeStart}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
          <TripDateInput
            value={rangeEnd}
            onChange={setRangeEnd}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
        </div>
        <TripPrimaryButton
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
          disabled={props.saving}
          className="mt-4"
        >
          {props.saving ? "Painting…" : "Paint range"}
        </TripPrimaryButton>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
