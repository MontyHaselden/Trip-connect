import { todayIso } from "@/lib/host/setup/calendar-bounds";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";

import type { CalendarProjection, CalendarRenderModel, TripEntityGraph } from "./types";

/** Minimal calendar shell so the board can render while the full projection builds. */
export function stubEngineCalendarView(
  graph: TripEntityGraph,
  groupId?: string,
): { calendarProjection: CalendarProjection; calendarRenderModel: CalendarRenderModel } {
  const gid = groupId ?? graph.mainGroupId;
  const bounds = effectiveTripBoundsFromState(graph);
  const datesUnset = tripDatesAreUnset(bounds.startDate, bounds.endDate);
  const today = todayIso(graph.basics.timezone);

  const calendarProjection: CalendarProjection = {
    groupId: gid,
    gridStart: bounds.startDate,
    gridEnd: bounds.endDate,
    days: [],
    accommodationByDate: new Map(),
    boundaries: [],
  };

  const calendarRenderModel: CalendarRenderModel = {
    groupId: gid,
    gridStart: bounds.startDate,
    gridEnd: bounds.endDate,
    tripStart: bounds.startDate,
    tripEnd: bounds.endDate,
    departureCity: graph.basics.departureCity,
    returnCity: graph.basics.returnCity,
    datesUnset,
    days: [],
    overlayMetaByDate: new Map(),
    accommodationByDate: new Map(),
    accommodationStays: [],
    boundaries: [],
    activitiesByDate: new Map(),
    projectedDays: [],
    locationColorByKey: new Map(),
    scrollAnchorDate: bounds.startDate,
    todayIso: today,
    interactionStart: datesUnset ? today : bounds.startDate,
  };

  return { calendarProjection, calendarRenderModel };
}

export function setupResponseIncludesCalendarView(
  body: Partial<{ calendarRenderModel?: CalendarRenderModel }>,
): boolean {
  const days = body.calendarRenderModel?.days?.length ?? 0;
  const projected = body.calendarRenderModel?.projectedDays?.length ?? 0;
  return days > 0 || projected > 0;
}
