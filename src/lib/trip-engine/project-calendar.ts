import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import { computeCalendarTransport } from "@/lib/host/wizard/transport-day-placement";
import type {
  CalendarProjection,
  ProjectedDay,
  TransportOverlay,
  ActivityMarker,
  TripEntityGraph,
} from "./types";
import { activitiesOnDate, dayPlacesForGroup, namedStays } from "./selectors";
import { filterCalendarDotActivities, activityToMarker } from "./calendar-activity-dots";

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
  const storedDays = dayPlacesForGroup(graph, groupId);
  const stays = namedStays(graph, groupId);

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

  const baseDays: ProjectedDay[] = derived.dayPlaces.map((day) => {
    const transportOverlays: TransportOverlay[] = [];
    const layouts = travelLayouts.get(day.date) ?? [];
    for (const layout of layouts) {
      if (layout.kind === "transit") {
        transportOverlays.push({
          legId: layout.label,
          label: layout.label,
          transportType: "plane",
          bookingStatus: layout.tentative ? "flexible" : "booked",
        });
      }
    }
    const transit = transitOverlays.get(day.date) ?? [];
    for (const t of transit) {
      transportOverlays.push({
        legId: t.label,
        label: t.label,
        transportType: "other",
        bookingStatus: "not_booked",
      });
    }

    const activities: ActivityMarker[] = filterCalendarDotActivities(
      activitiesOnDate(graph, day.date),
    ).map(activityToMarker);

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
      transportOverlays,
      activities,
      warnings,
      overlayMeta: "inherit",
    };
  });

  let days = baseDays;
  if (groupId !== graph.mainGroupId) {
    const mainProjection = projectCalendar(graph, {
      groupId: graph.mainGroupId,
      gridStart,
      gridEnd,
      overlayStoredLocationGaps: true,
    });
    days = resolveSubgroupDays(mainProjection.days, baseDays);
  }

  for (const date of enumerateDates(gridStart, gridEnd)) {
    if (!days.some((d) => d.date === date)) {
      days.push(emptyDay(date, groupId));
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
