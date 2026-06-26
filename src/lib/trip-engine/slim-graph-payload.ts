import { calendarGridFromToday } from "@/lib/host/setup/calendar-bounds";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import type { TripEntityGraph } from "./types";

export type GraphPayloadStats = {
  groups: number;
  dayPlaceRows: number;
  maxDayPlacesPerGroup: number;
  activities: number;
  outboundLegs: number;
  returnLegs: number;
  intercityLegs: number;
  accommodationStays: number;
  transportProducts: number;
  estimatedJsonBytes: number;
};

export function graphPayloadStats(graph: TripEntityGraph): GraphPayloadStats {
  return cheapGraphStats(graph);
}

/** Fast counts only — never JSON.stringify the full graph on hot paths. */
export function cheapGraphStats(graph: TripEntityGraph): GraphPayloadStats {
  let dayPlaceRows = 0;
  let maxDayPlacesPerGroup = 0;
  for (const days of Object.values(graph.dayPlacesByGroupId)) {
    dayPlaceRows += days.length;
    maxDayPlacesPerGroup = Math.max(maxDayPlacesPerGroup, days.length);
  }
  return {
    groups: graph.groups.length,
    dayPlaceRows,
    maxDayPlacesPerGroup,
    activities: graph.activities.length,
    outboundLegs: graph.outboundLegs.length,
    returnLegs: graph.returnLegs.length,
    intercityLegs: graph.intercityLegs.length,
    accommodationStays: graph.accommodationStays.length,
    transportProducts: (graph.transportProducts ?? []).length,
    estimatedJsonBytes: 0,
  };
}

/** Optional — only for offline diagnostics scripts. */
export function graphPayloadJsonBytes(graph: TripEntityGraph): number {
  return new TextEncoder().encode(JSON.stringify(graph)).length;
}

/** Drop off-grid / duplicate day-place rows so client payloads stay bounded. */
export function slimGraphPayloadForEngine(graph: TripEntityGraph): TripEntityGraph {
  const bounds = boundsForSlimPayload(graph);
  const scope = calendarContentDates(graph);
  const grid = calendarGridFromToday({
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    timezone: graph.basics.timezone,
    dayPlaces: graph.dayPlacesByGroupId[graph.mainGroupId],
    accommodationStays: graph.accommodationStays,
    transportDates: scope.transportDates,
    activityDates: scope.activityDates,
  });
  const allowed = new Set(enumerateDates(grid.gridStart, grid.gridEnd));
  const dayPlacesByGroupId: Record<string, DayPlaceDraft[]> = {};

  for (const [groupId, days] of Object.entries(graph.dayPlacesByGroupId)) {
    const byDate = new Map<string, DayPlaceDraft>();
    for (const day of days) {
      if (!allowed.has(day.date)) continue;
      byDate.set(day.date, day);
    }
    dayPlacesByGroupId[groupId] = [...byDate.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  return { ...graph, dayPlacesByGroupId };
}

/** Initial engine load — main-group day paint only; personal overlays load on demand. */
export function minimalEngineGraphPayload(graph: TripEntityGraph): TripEntityGraph {
  const slim = slimGraphPayloadForEngine(graph);
  const mainDays = slim.dayPlacesByGroupId[slim.mainGroupId] ?? [];
  const inGridActivities = filterActivitiesToGrid(slim);
  const dayPlacesByGroupId: Record<string, DayPlaceDraft[]> = {};
  for (const group of slim.groups) {
    dayPlacesByGroupId[group.id] =
      group.id === slim.mainGroupId ? mainDays : [];
  }
  return {
    ...slim,
    dayPlacesByGroupId,
    activities: inGridActivities,
  };
}

function filterActivitiesToGrid(graph: TripEntityGraph) {
  const bounds = boundsForSlimPayload(graph);
  const { gridStart, gridEnd } = calendarGridFromToday({
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    timezone: graph.basics.timezone,
    dayPlaces: graph.dayPlacesByGroupId[graph.mainGroupId],
    accommodationStays: graph.accommodationStays,
    ...calendarContentDates(graph),
  });
  return graph.activities.filter(
    (a) => a.date >= gridStart && a.date <= gridEnd,
  );
}

function boundsForSlimPayload(graph: TripEntityGraph): {
  startDate: string;
  endDate: string;
} {
  if (!tripDatesAreUnset(graph.basics.startDate, graph.basics.endDate)) {
    return {
      startDate: graph.basics.startDate,
      endDate: graph.basics.endDate,
    };
  }
  const derived = effectiveTripBoundsFromState(graph);
  return { startDate: derived.startDate, endDate: derived.endDate };
}

function calendarContentDates(graph: TripEntityGraph): {
  transportDates: string[];
  activityDates: string[];
} {
  const transportDates: string[] = [];
  for (const leg of [
    ...graph.outboundLegs,
    ...graph.returnLegs,
    ...graph.intercityLegs,
  ]) {
    if (leg.travelDate?.trim()) transportDates.push(leg.travelDate);
  }
  return {
    transportDates,
    activityDates: graph.activities.map((a) => a.date).filter((d) => d.trim()),
  };
}
