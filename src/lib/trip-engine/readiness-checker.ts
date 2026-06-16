import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import { computeTripWarnings } from "@/lib/host/trip-warnings";
import { analyzeImportGaps } from "@/lib/host/wizard/analyze-import-gaps";
import { detectGroupCityMoves } from "@/lib/groups/detect-group-city-moves";
import {
  effectiveTripBoundsFromState,
  uncoveredTripDays,
} from "@/lib/host/setup/sync-trip-bounds";
import type { SetupReadinessStatus, SetupSectionId, SetupSectionReadiness } from "@/lib/host/setup/types";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";
import { classifyFlightLeg } from "@/lib/host/setup/classify-flight-legs";
import { deriveLastAbroadDay, deriveTripBoundsFromContent } from "@/lib/host/setup/derive-trip-bounds";
import { legNeedsScheduleRepair } from "@/lib/host/setup/repair-transport-legs";
import { tripBoundsInputFromState } from "@/lib/host/setup/sync-trip-bounds";

import type { EngineWarning, TripEntityGraph } from "./types";

function worstStatus(
  statuses: SetupReadinessStatus[],
  emptyDefault: SetupReadinessStatus = "todo",
): SetupReadinessStatus {
  if (!statuses.length) return emptyDefault;
  const order: SetupReadinessStatus[] = [
    "conflict",
    "decision",
    "todo",
    "flexible",
    "complete",
    "idle",
  ];
  for (const s of order) {
    if (statuses.includes(s)) return s;
  }
  return emptyDefault;
}

function bookingToStatus(status: string | null | undefined): SetupReadinessStatus {
  if (status === "booked") return "complete";
  if (status === "flexible") return "flexible";
  if (status === "placeholder") return "flexible";
  if (status === "not_booked") return "todo";
  return "todo";
}

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  locations: "Locations",
  accommodation: "Accommodation",
  transport: "Transport",
  activities: "Activities",
  groups: "Groups",
  participants: "Participants",
  bookings: "Bookings",
  emergency: "Emergency",
  photos_viewers: "Photos & viewers",
  publish: "Publish",
};

/** Structured readiness from the entity graph — replaces scattered setup-readiness logic. */
export async function checkReadiness(
  graph: TripEntityGraph,
  snapshot?: PublishedTripSnapshotV1 | null,
): Promise<SetupSectionReadiness[]> {
  const gaps = await analyzeImportGaps(graph.tripId);
  const warnings = snapshot ? computeTripWarnings(snapshot) : [];
  const conflictWarnings = warnings.filter((w) => w.severity === "error");
  const todoWarnings = warnings.filter((w) => w.severity === "warning");

  const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
  const tripBounds = effectiveTripBoundsFromState(graph);
  const uncovered = uncoveredTripDays(mainDays, tripBounds.startDate, tripBounds.endDate);
  const hasPlannedDays = mainDays.some((d) => d.primaryCity.trim());

  const transportStatuses = [
    ...graph.outboundLegs,
    ...graph.returnLegs,
    ...graph.intercityLegs,
  ].map((l) => bookingToStatus(l.bookingStatus));

  const stayStatuses = graph.accommodationStays.map((s) =>
    s.stayType === "not_booked" || !s.name?.trim() ? "todo" : ("complete" as SetupReadinessStatus),
  );

  const groupMoves = graph.groups
    .filter((g) => !g.isMain)
    .flatMap((g) => {
      const groupDays = graph.dayPlacesByGroupId[g.id] ?? [];
      return detectGroupCityMoves(mainDays, groupDays, false);
    });

  const overviewStatus: SetupReadinessStatus = conflictWarnings.length
    ? "conflict"
    : tripNameNeedsAttention(graph.basics.name)
      ? "todo"
      : "complete";

  const locationsReady = hasPlannedDays && uncovered.length === 0;
  const activityStatuses = graph.activities.map((a) =>
    a.title.trim() ? ("complete" as SetupReadinessStatus) : "todo",
  );

  const sections: Array<{ id: keyof typeof SECTION_LABELS; status: SetupReadinessStatus; message?: string }> = [
    { id: "overview", status: overviewStatus },
    {
      id: "locations",
      status: locationsReady ? "complete" : uncovered.length ? "todo" : "todo",
      message: uncovered.length ? `${uncovered.length} day(s) without a location` : undefined,
    },
    {
      id: "accommodation",
      status: stayStatuses.length === 0 ? "todo" : worstStatus(stayStatuses),
    },
    {
      id: "transport",
      status:
        transportStatuses.length === 0
          ? "todo"
          : groupMoves.length
            ? "todo"
            : worstStatus(transportStatuses),
    },
    {
      id: "activities",
      status: activityStatuses.length === 0 ? "idle" : worstStatus(activityStatuses, "idle"),
    },
    {
      id: "groups",
      status: graph.groups.length <= 1 ? "idle" : "complete",
    },
    { id: "participants", status: "idle" },
    { id: "bookings", status: gaps.length ? "todo" : "complete" },
    { id: "emergency", status: "idle" },
    { id: "photos_viewers", status: "idle" },
    {
      id: "publish",
      status: conflictWarnings.length
        ? "conflict"
        : todoWarnings.length
          ? "decision"
          : gaps.length || !locationsReady
            ? "todo"
            : "complete",
    },
  ];

  return sections.map((s) => ({
    id: s.id as SetupSectionId,
    label: SECTION_LABELS[s.id] ?? s.id,
    status: s.status,
    message: s.message,
  }));
}

/** Flat engine warnings for inspector badges. */
export function graphWarnings(graph: TripEntityGraph): EngineWarning[] {
  const warnings: EngineWarning[] = [];
  const bounds = effectiveTripBoundsFromState(graph);
  const uncovered = uncoveredTripDays(
    graph.dayPlacesByGroupId[graph.mainGroupId] ?? [],
    bounds.startDate,
    bounds.endDate,
  );

  for (const day of uncovered) {
    warnings.push({
      id: `uncovered-${day.date}`,
      severity: "warning",
      section: "locations",
      message: `No location planned for ${day.date}`,
      date: day.date,
    });
  }

  for (const stay of graph.accommodationStays) {
    if (!stay.name?.trim()) {
      warnings.push({
        id: `stay-unnamed-${stay.id}`,
        severity: "info",
        section: "accommodation",
        message: "Accommodation block without a property name",
        entityType: "accommodation_stay",
        entityId: stay.id,
      });
    }
  }

  for (const leg of graph.intercityLegs) {
    if (leg.transportType !== "plane") continue;
    if (classifyFlightLeg(leg, graph) !== "return") continue;
    warnings.push({
      id: `transport-misclassified-${leg.id}`,
      severity: "warning",
      section: "transport",
      message: `${leg.flightNumber ?? "Flight"} looks like a return leg but is stored as intercity`,
      entityType: "transport_leg",
      entityId: leg.id,
      date: leg.travelDate,
    });
  }

  for (const leg of [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs]) {
    if (!legNeedsScheduleRepair(leg)) continue;
    warnings.push({
      id: `transport-incomplete-${leg.id}`,
      severity: "warning",
      section: "transport",
      message: `${leg.flightNumber ?? "Flight"} is missing schedule times or arrival date`,
      entityType: "transport_leg",
      entityId: leg.id,
      date: leg.travelDate,
    });
  }

  const boundsInput = tripBoundsInputFromState(graph);
  const lastAbroad = deriveLastAbroadDay(boundsInput);
  const contentBounds = deriveTripBoundsFromContent(boundsInput);
  if (
    lastAbroad &&
    contentBounds &&
    graph.basics.endDate &&
    graph.basics.endDate > lastAbroad
  ) {
    warnings.push({
      id: "trip-end-after-abroad",
      severity: "warning",
      section: "transport",
      message: `Trip end date ${graph.basics.endDate} is after last day abroad (${lastAbroad})`,
    });
  }

  return warnings;
}
