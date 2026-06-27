import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import {
  dayPlacesToSlices,
  mergeOverrides,
  slicesToDayPlaces,
} from "@/lib/calendar-core";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type {
  CalendarProjection,
  ProjectedDay,
  ActivityMarker,
  TripEntityGraph,
} from "./types";
import type { ActivityDraft } from "@/lib/host/wizard/types";
import { activitiesForCalendarView } from "./person-lens";
import { calendarContentScopeForGroup, dayPlacesForGroup } from "./selectors";
import { activityToMarker, filterCalendarDotActivities } from "./calendar-activity-dots";
import {
  participantInheritsMainCalendar,
  personalGroupForGroupId,
} from "./person-lens";

export type ProjectCalendarOptions = {
  groupId?: string;
  overlayStoredLocationGaps?: boolean;
  gridStart?: string;
  gridEnd?: string;
};

function emptyDayPlace(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function emptyProjectedDay(date: string, groupId: string): ProjectedDay {
  return {
    date,
    groupId,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    accommodationLabel: null,
    transportOverlays: [],
    activities: [],
    warnings: [],
    overlayMeta: "inherit",
  };
}

function storedDaysForGroup(graph: TripEntityGraph, groupId: string): DayPlaceDraft[] {
  const mainSlices = dayPlacesToSlices(dayPlacesForGroup(graph, graph.mainGroupId));
  const groupSlices = dayPlacesToSlices(dayPlacesForGroup(graph, groupId));

  if (groupId === graph.mainGroupId) {
    return slicesToDayPlaces(mainSlices);
  }

  if (participantInheritsMainCalendar(graph, groupId)) {
    return slicesToDayPlaces(mainSlices);
  }

  const personal = personalGroupForGroupId(graph, groupId);
  if (personal?.inheritMode === "independent") {
    return slicesToDayPlaces(groupSlices);
  }

  return slicesToDayPlaces(mergeOverrides(mainSlices, groupSlices, "override"));
}

function overlayMetaForDay(
  graph: TripEntityGraph,
  groupId: string,
  date: string,
  day: DayPlaceDraft,
): ProjectedDay["overlayMeta"] {
  if (groupId === graph.mainGroupId) return "inherit";
  const personal = personalGroupForGroupId(graph, groupId);
  if (!personal || participantInheritsMainCalendar(graph, groupId)) return "inherit";
  if (personal.inheritMode === "independent") return "override";
  const stored = dayPlacesForGroup(graph, groupId);
  const hasOverride = stored.some((d) => d.date === date);
  if (!hasOverride) return "inherit";
  const hasPaint = Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
  return hasPaint ? "override" : "inherit";
}

function indexCalendarActivitiesByDate(
  activities: ActivityDraft[],
): Map<string, ActivityDraft[]> {
  const dotted = filterCalendarDotActivities(activities);
  const map = new Map<string, ActivityDraft[]>();
  for (const activity of dotted) {
    const end = activity.endDate?.trim() || activity.date;
    for (const date of enumerateDates(activity.date, end)) {
      const bucket = map.get(date);
      if (bucket) bucket.push(activity);
      else map.set(date, [activity]);
    }
  }
  return map;
}

export function projectCalendar(
  graph: TripEntityGraph,
  options?: ProjectCalendarOptions,
): CalendarProjection {
  const groupId = options?.groupId ?? graph.mainGroupId;
  const bounds = effectiveTripBoundsFromState(graph);
  let gridStart = options?.gridStart ?? bounds.startDate;
  let gridEnd = options?.gridEnd ?? bounds.endDate;
  if (tripDatesAreUnset(gridStart, gridEnd)) {
    const basicsStart = graph.basics.startDate.trim();
    const basicsEnd = graph.basics.endDate.trim();
    if (!tripDatesAreUnset(basicsStart, basicsEnd)) {
      gridStart = basicsStart;
      gridEnd = basicsEnd;
    }
  }

  const storedDays = storedDaysForGroup(graph, groupId);
  const paintedDates = storedDays
    .filter((day) => day.primaryCity.trim() || day.secondaryCity?.trim())
    .map((day) => day.date);
  if (paintedDates.length) {
    const minPaint = paintedDates.reduce((a, b) => (a < b ? a : b));
    const maxPaint = paintedDates.reduce((a, b) => (a > b ? a : b));
    if (!tripDatesAreUnset(gridStart, gridEnd)) {
      if (minPaint < gridStart) gridStart = minPaint;
      if (maxPaint > gridEnd) gridEnd = maxPaint;
    } else {
      gridStart = minPaint;
      gridEnd = maxPaint;
    }
  }

  const basicsStart = graph.basics.startDate.trim();
  const basicsEnd = graph.basics.endDate.trim();
  if (!tripDatesAreUnset(basicsStart, basicsEnd) && !tripDatesAreUnset(gridStart, gridEnd)) {
    if (basicsStart < gridStart) gridStart = basicsStart;
    if (basicsEnd > gridEnd) gridEnd = basicsEnd;
  }
  const scope = calendarContentScopeForGroup(graph, groupId);

  const derived = deriveCalendarState({
    stays: scope.stays,
    intercityLegs: scope.intercityLegs,
    trip: {
      departureCity: graph.basics.departureCity,
      returnCity: graph.basics.returnCity,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
    },
    transportDraft: {
      outboundLegs: scope.outboundLegs,
      returnLegs: scope.returnLegs,
      intercityLegs: scope.intercityLegs,
      dayPlaces: storedDays,
    },
    gridStart,
    gridEnd,
    overlayStoredLocationGaps: false,
    inferLocationsFromTransport: false,
  });

  const storedByDate = new Map(storedDays.map((day) => [day.date, day]));
  const groupActivities = activitiesForCalendarView(graph, groupId);
  const activitiesOnDate = indexCalendarActivitiesByDate(groupActivities);

  const days: ProjectedDay[] = enumerateDates(gridStart, gridEnd).map((date) => {
    const day = storedByDate.get(date) ?? emptyDayPlace(date);
    const onDate = activitiesOnDate.get(date) ?? [];
    const activities: ActivityMarker[] = onDate.map(activityToMarker);
    const warnings: ProjectedDay["warnings"] = [];

    if (derived.accommodationByDate.has(date) && !day.primaryCity.trim() && !day.secondaryCity?.trim()) {
      warnings.push({
        id: `accom-no-city-${date}`,
        message: `Accommodation without city paint on ${date}`,
        severity: "warning",
      });
    }

    return {
      date,
      groupId,
      primaryCity: day.primaryCity,
      secondaryCity: day.secondaryCity,
      primaryShare: day.primaryShare,
      dayType: day.dayType,
      accommodationLabel: derived.accommodationByDate.get(date) ?? null,
      transportOverlays: [],
      activities,
      warnings,
      overlayMeta: overlayMetaForDay(graph, groupId, date, day),
    };
  });

  return {
    groupId,
    gridStart,
    gridEnd,
    days,
    accommodationByDate: derived.accommodationByDate,
    boundaries: derived.boundaries,
  };
}

export function projectMainCalendar(
  graph: TripEntityGraph,
  options?: Omit<ProjectCalendarOptions, "groupId">,
): CalendarProjection {
  return projectCalendar(graph, { ...options, groupId: graph.mainGroupId });
}
