import { calendarGridFromToday } from "@/lib/host/setup/calendar-bounds";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import { enumerateDates, normalizeDayShare } from "@/lib/host/wizard/location-stays";
import {
  buildTripLocationColorMap,
  collectOrderedTripLocationNames,
  type LocationPaletteSwatch,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import { projectCalendar, type ProjectCalendarOptions } from "./project-calendar";
import { participantInheritsMainCalendar, participantUsesLocationOverlayProjection, activitiesForCalendarView } from "./person-lens";
import { dayPlacesForGroup, namedStays, calendarContentScopeForGroup } from "./selectors";
import type {
  ActivityMarker,
  CalendarRenderModel,
  OverlayMeta,
  ProjectedDay,
  TripEntityGraph,
} from "./types";
import { activityToMarker, filterCalendarDotActivities } from "./calendar-activity-dots";

function projectedToDayPlace(day: ProjectedDay): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: day.primaryCity,
    secondaryCity: day.secondaryCity,
    primaryShare: normalizeDayShare(day.primaryShare),
    dayType: day.dayType,
    includeBuffer: false,
  };
}

function usesMainGroupCalendarContent(graph: TripEntityGraph, groupId: string): boolean {
  return (
    participantInheritsMainCalendar(graph, groupId) ||
    participantUsesLocationOverlayProjection(graph, groupId)
  );
}

function buildActivitiesByDate(
  graph: TripEntityGraph,
  dates: string[],
  groupId: string,
): Map<string, ActivityMarker[]> {
  const activities = usesMainGroupCalendarContent(graph, groupId)
    ? activitiesForCalendarView(graph, graph.mainGroupId)
    : activitiesForCalendarView(graph, groupId);
  const map = new Map<string, ActivityMarker[]>();
  for (const date of dates) {
    const onDate = activities.filter((a) => {
      const end = a.endDate?.trim() || a.date;
      return a.date <= date && date <= end;
    });
    const markers = filterCalendarDotActivities(onDate).map(activityToMarker);
    if (markers.length) map.set(date, markers);
  }
  return map;
}

export function buildCalendarRenderModel(
  graph: TripEntityGraph,
  options?: ProjectCalendarOptions,
): CalendarRenderModel {
  const groupId = options?.groupId ?? graph.mainGroupId;
  const bounds = effectiveTripBoundsFromState(graph);
  const datesUnset = tripDatesAreUnset(bounds.startDate, bounds.endDate);
  const storedDays = dayPlacesForGroup(graph, groupId);
  const scope = calendarContentScopeForGroup(graph, groupId);

  const transportDates: string[] = [];
  for (const leg of [...scope.outboundLegs, ...scope.returnLegs, ...scope.intercityLegs]) {
    if (leg.travelDate?.trim()) transportDates.push(leg.travelDate);
  }

  const activityDates = graph.activities.map((a) => a.date).filter((d) => d.trim());

  const gridMeta = calendarGridFromToday({
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    timezone: graph.basics.timezone,
    dayPlaces: storedDays,
    accommodationStays: scope.stays,
    transportDates,
    activityDates,
  });
  const gridStart = options?.gridStart ?? gridMeta.gridStart;
  const gridEnd = options?.gridEnd ?? gridMeta.gridEnd;

  const projection = projectCalendar(graph, { groupId, gridStart, gridEnd, ...options });
  const allDates = enumerateDates(gridStart, gridEnd);
  const days = projection.days.map(projectedToDayPlace);

  const overlayMetaByDate = new Map<string, OverlayMeta>();
  for (const pd of projection.days) {
    overlayMetaByDate.set(pd.date, pd.overlayMeta);
  }

  const locationColorByKey = buildTripLocationColorMap(
    collectOrderedTripLocationNames({
      days,
      departureCity: graph.basics.departureCity,
      returnCity: graph.basics.returnCity,
    }),
  );

  return {
    groupId,
    gridStart,
    gridEnd,
    tripStart: bounds.startDate,
    tripEnd: bounds.endDate,
    departureCity: graph.basics.departureCity,
    returnCity: graph.basics.returnCity,
    datesUnset,
    days,
    overlayMetaByDate,
    accommodationByDate: projection.accommodationByDate,
    accommodationStays: usesMainGroupCalendarContent(graph, groupId)
      ? namedStays(graph, graph.mainGroupId)
      : namedStays(graph, groupId),
    boundaries: projection.boundaries,
    activitiesByDate: buildActivitiesByDate(graph, allDates, groupId),
    projectedDays: projection.days,
    locationColorByKey,
    scrollAnchorDate: gridMeta.scrollAnchorDate,
    todayIso: gridMeta.todayIso,
    interactionStart: gridMeta.interactionStart,
  };
}
