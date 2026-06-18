import { calendarGridFromToday } from "@/lib/host/setup/calendar-bounds";
import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import {
  buildTripLocationColorMap,
  collectOrderedTripLocationNames,
  type LocationPaletteSwatch,
} from "@/lib/host/wizard/location-stays";
import {
  computeCalendarTransport,
  type CalendarDaySegment,
  type TransitOverlay,
} from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import { projectCalendar, type ProjectCalendarOptions } from "./project-calendar";
import type {
  ActivityMarker,
  CalendarRenderModel,
  OverlayMeta,
  ProjectedDay,
  TripEntityGraph,
} from "./types";
import { dayPlacesForGroup, namedStays } from "./selectors";
import { calendarDotActivitiesForDate } from "./calendar-activity-dots";

function projectedToDayPlace(day: ProjectedDay): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: day.primaryCity,
    secondaryCity: day.secondaryCity,
    primaryShare: day.primaryShare,
    dayType: day.dayType,
    includeBuffer: false,
  };
}

function buildActivitiesByDate(graph: TripEntityGraph, dates: string[]): Map<string, ActivityMarker[]> {
  const map = new Map<string, ActivityMarker[]>();
  for (const date of dates) {
    const markers = calendarDotActivitiesForDate(graph.activities, date);
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

  const transportDates: string[] = [];
  for (const leg of [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs]) {
    if (leg.travelDate?.trim()) transportDates.push(leg.travelDate);
  }

  const activityDates = graph.activities.map((a) => a.date).filter((d) => d.trim());

  const gridMeta = calendarGridFromToday({
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    timezone: graph.basics.timezone,
    dayPlaces: storedDays,
    accommodationStays: graph.accommodationStays,
    transportDates,
    activityDates,
  });
  const gridStart = options?.gridStart ?? gridMeta.gridStart;
  const gridEnd = options?.gridEnd ?? gridMeta.gridEnd;

  const derived = deriveCalendarState({
    stays: graph.accommodationStays,
    intercityLegs: graph.intercityLegs,
    trip: {
      departureCity: graph.basics.departureCity,
      returnCity: graph.basics.returnCity,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
    },
    transportDraft: {
      outboundLegs: graph.outboundLegs,
      returnLegs: graph.returnLegs,
      intercityLegs: graph.intercityLegs,
      dayPlaces: storedDays,
    },
    gridStart,
    gridEnd,
    overlayStoredLocationGaps: options?.overlayStoredLocationGaps ?? groupId === graph.mainGroupId,
  });

  const transportDraft = {
    outboundLegs: graph.outboundLegs,
    returnLegs: graph.returnLegs,
    intercityLegs: graph.intercityLegs,
    dayPlaces: derived.dayPlaces,
  };
  const tripContext = {
    startDate: bounds.startDate,
    endDate: bounds.endDate,
    departureCity: graph.basics.departureCity,
    returnCity: graph.basics.returnCity,
  };
  const { travelLayouts, transitOverlays } = computeCalendarTransport(transportDraft, tripContext, {
    stays: graph.accommodationStays,
  });

  const projection = projectCalendar(graph, { groupId, gridStart, gridEnd, ...options });
  const allDates = enumerateDates(gridStart, gridEnd);
  const days = projection.days.map(projectedToDayPlace);

  let baseDays: DayPlaceDraft[] | undefined;
  const overlayMetaByDate = new Map<string, OverlayMeta>();
  for (const pd of projection.days) {
    overlayMetaByDate.set(pd.date, pd.overlayMeta);
  }

  if (groupId !== graph.mainGroupId) {
    const mainProj = projectCalendar(graph, {
      groupId: graph.mainGroupId,
      gridStart,
      gridEnd,
      overlayStoredLocationGaps: true,
    });
    baseDays = mainProj.days.map(projectedToDayPlace);
  }

  const segmentCities: string[] = [];
  for (const segments of travelLayouts.values()) {
    for (const segment of segments) {
      if (segment.kind === "city") segmentCities.push(segment.city);
    }
  }
  const locationColorByKey = buildTripLocationColorMap(
    collectOrderedTripLocationNames({
      days,
      departureCity: graph.basics.departureCity,
      returnCity: graph.basics.returnCity,
      segmentCities,
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
    baseDays,
    overlayMetaByDate,
    travelLayoutsByDate: travelLayouts,
    transitByDate: transitOverlays,
    accommodationByDate: derived.accommodationByDate,
    accommodationStays: namedStays(graph, groupId),
    boundaries: derived.boundaries,
    activitiesByDate: buildActivitiesByDate(graph, allDates),
    projectedDays: projection.days,
    locationColorByKey,
    scrollAnchorDate: gridMeta.scrollAnchorDate,
    todayIso: gridMeta.todayIso,
    interactionStart: gridMeta.interactionStart,
  };
}

export type { CalendarDaySegment, TransitOverlay };
