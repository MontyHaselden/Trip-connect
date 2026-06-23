"use client";

import { useMemo } from "react";

import {
  formatLocationStayRange,
  locationRangesFromContent,
} from "@/lib/host/setup/location-range-display";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { hasScheduledReturnTransport } from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import { projectCalendar } from "@/lib/trip-engine/project-calendar";
import { calendarContentScopeForGroup } from "@/lib/trip-engine/selectors";
import type { ProjectedDay, TripEntityGraph } from "@/lib/trip-engine/types";

import { TripListRow, TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

function projectedToDayPlace(day: ProjectedDay): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: day.primaryCity,
    secondaryCity: day.secondaryCity,
    primaryShare: day.primaryShare ?? 1,
    dayType: day.dayType,
    includeBuffer: false,
  };
}

export function LocationsSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  selectedDate?: string | null;
}) {

  const bounds = effectiveTripBoundsFromState(props.graph);
  const scope = calendarContentScopeForGroup(props.graph, props.groupId);

  const locationRanges = useMemo(() => {
    const projection = projectCalendar(props.graph, { groupId: props.groupId });
    const days = projection.days.map(projectedToDayPlace);

    return locationRangesFromContent({
      days,
      tripStart: bounds.startDate,
      tripEnd: bounds.endDate,
      departureCity: props.graph.basics.departureCity,
      returnCity: props.graph.basics.returnCity,
      hasReturnTransport: hasScheduledReturnTransport(props.graph, {
        endDate: bounds.endDate,
        returnCity: props.graph.basics.returnCity,
      }),
      accommodationStays: scope.stays,
      outboundLegs: scope.outboundLegs,
      returnLegs: scope.returnLegs,
      intercityLegs: scope.intercityLegs,
    });
  }, [props.graph, props.groupId, bounds.startDate, bounds.endDate, scope]);

  return (
    <TripSectionShell
      title="Locations"
      description="City ranges as shown on the trip calendar. Paint or change them by selecting days on the calendar."
    >
      <TripSoftPanel>
        {locationRanges.length ? (
          <ul className="space-y-1.5">
            {locationRanges.map((range) => (
              <TripListRow key={`${range.location}-${range.startDate}-${range.endDate}`}>
                {formatLocationStayRange(range)}
              </TripListRow>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm leading-relaxed text-zinc-500">
            No locations on the calendar yet. Select days on the trip calendar and use{" "}
            <span className="font-medium text-zinc-700">Location → Add</span> there.
          </p>
        )}
      </TripSoftPanel>
    </TripSectionShell>
  );
}
