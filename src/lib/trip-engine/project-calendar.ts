import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
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
import { resolveDisplayDayPlaces } from "./resolve-display-day-places";
import {
  participantInheritsMainCalendar,
  participantUsesLocationOverlayProjection,
  personalGroupForGroupId,
} from "./person-lens";
import { mergeParticipantLocationOverlay } from "./merge-participant-location-overlay";

export type ProjectCalendarOptions = {
  groupId?: string;
  overlayStoredLocationGaps?: boolean;
  gridStart?: string;
  gridEnd?: string;
};

function emptyDay(date: string, groupId: string): ProjectedDay {
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

function resolveSubgroupDays(main: ProjectedDay[], overlay: ProjectedDay[]): ProjectedDay[] {
  const mainByDate = new Map(main.map((d) => [d.date, d]));
  const overlayByDate = new Map(overlay.map((d) => [d.date, d]));
  const dates = new Set([...mainByDate.keys(), ...overlayByDate.keys()]);
  return [...dates].sort().map((date) => {
    const o = overlayByDate.get(date);
    const m = mainByDate.get(date);
    if (!o) return m ?? emptyDay(date, main[0]?.groupId ?? "");
    if (!m) return { ...o, overlayMeta: "add" as const };
    const hasOverlayPaint = Boolean(o.primaryCity.trim() || o.secondaryCity?.trim());
    if (hasOverlayPaint) return { ...o, overlayMeta: "override" as const };
    return { ...m, overlayMeta: "inherit" as const };
  });
}

export function projectCalendar(
  graph: TripEntityGraph,
  options?: ProjectCalendarOptions,
): CalendarProjection {
  const groupId = options?.groupId ?? graph.mainGroupId;
  const bounds = effectiveTripBoundsFromState(graph);
  const gridStart = options?.gridStart ?? bounds.startDate;
  const gridEnd = options?.gridEnd ?? bounds.endDate;

  if (groupId !== graph.mainGroupId && participantInheritsMainCalendar(graph, groupId)) {
    const main = projectCalendar(graph, {
      ...options,
      groupId: graph.mainGroupId,
      gridStart,
      gridEnd,
    });
    if (groupId === graph.mainGroupId) return main;
    return {
      ...main,
      groupId,
      days: main.days.map((day) => ({
        ...day,
        groupId,
        overlayMeta: "inherit" as const,
      })),
    };
  }

  if (groupId !== graph.mainGroupId && participantUsesLocationOverlayProjection(graph, groupId)) {
    const main = projectCalendar(graph, {
      ...options,
      groupId: graph.mainGroupId,
      gridStart,
      gridEnd,
    });
    const storedOverlay = dayPlacesForGroup(graph, groupId);
    const days = mergeParticipantLocationOverlay(main.days, storedOverlay).map((day) => ({
      ...day,
      groupId,
    }));
    return { ...main, groupId, days };
  }

  const storedDays = dayPlacesForGroup(graph, groupId);
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

  const displayDays = resolveDisplayDayPlaces(storedDays, derived.dayPlaces, gridStart, gridEnd);

  const groupActivities = activitiesForCalendarView(graph, groupId);
  const activitiesOnDate = indexCalendarActivitiesByDate(groupActivities);

  const baseDays: ProjectedDay[] = displayDays.map((day) => {
    const onDate = activitiesOnDate.get(day.date) ?? [];
    const activities: ActivityMarker[] = onDate.map(activityToMarker);

    const warnings: ProjectedDay["warnings"] = [];
    if (derived.accommodationByDate.has(day.date) && !day.primaryCity.trim() && !day.secondaryCity?.trim()) {
      warnings.push({
        id: `accom-no-city-${day.date}`,
        message: `Accommodation without city paint on ${day.date}`,
        severity: "warning",
      });
    }

    return {
      date: day.date,
      groupId,
      primaryCity: day.primaryCity,
      secondaryCity: day.secondaryCity,
      primaryShare: day.primaryShare,
      dayType: day.dayType,
      accommodationLabel: derived.accommodationByDate.get(day.date) ?? null,
      transportOverlays: [],
      activities,
      warnings,
      overlayMeta: "inherit",
    };
  });

  let days = baseDays;
  if (groupId !== graph.mainGroupId) {
    const personal = personalGroupForGroupId(graph, groupId);
    const skipMainMerge =
      personal?.inheritMode === "independent" ||
      participantUsesLocationOverlayProjection(graph, groupId);
    if (!skipMainMerge) {
      const mainProjection = projectCalendar(graph, {
        groupId: graph.mainGroupId,
        gridStart,
        gridEnd,
        overlayStoredLocationGaps: true,
      });
      days = resolveSubgroupDays(mainProjection.days, baseDays);
    }
  }

  const dayIndex = new Set(days.map((d) => d.date));
  for (const date of enumerateDates(gridStart, gridEnd)) {
    if (!dayIndex.has(date)) {
      days.push(emptyDay(date, groupId));
      dayIndex.add(date);
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));

  return {
    groupId,
    gridStart,
    gridEnd,
    days,
    accommodationByDate: derived.accommodationByDate,
    boundaries: derived.boundaries,
  };
}
