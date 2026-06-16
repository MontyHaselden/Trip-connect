import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import {
  samePropertyStaysMergeable,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import type { TripEntityGraph, EngineConflict, CalendarProjection } from "./types";
import { namedStays, legsOnDate } from "./selectors";
import {
  staysOverlapNights,
  staysAreAdjacentHandoff,
  transportLegCityMismatch,
} from "./conflict-rules";

export function detectStayOverlaps(graph: TripEntityGraph, groupId: string): EngineConflict[] {
  const conflicts: EngineConflict[] = [];
  const stays = namedStays(graph, groupId);
  for (let i = 0; i < stays.length; i++) {
    for (let j = i + 1; j < stays.length; j++) {
      const a = stays[i]!;
      const b = stays[j]!;
      if (staysAreAdjacentHandoff(a, b, (stay) => stayCityLabel(stay as typeof a))) continue;
      if (samePropertyStaysMergeable(a, b)) continue;
      if (
        staysOverlapNights(a.checkInDate, a.checkOutDate, b.checkInDate, b.checkOutDate)
      ) {
        conflicts.push({
          id: `stay-overlap-${a.id}-${b.id}`,
          severity: "blocking",
          section: "accommodation",
          message: `Stays "${a.name}" and "${b.name}" overlap`,
          entityType: "accommodation_stay",
          entityId: a.id,
        });
      }
    }
  }
  return conflicts;
}

export function detectTransportCityMismatches(
  graph: TripEntityGraph,
  projection: CalendarProjection,
): EngineConflict[] {
  const conflicts: EngineConflict[] = [];
  for (const day of projection.days) {
    const legs = legsOnDate(graph, day.date);
    if (!legs.length) continue;

    const paintedCities = [day.primaryCity.trim(), day.secondaryCity?.trim() ?? ""].filter(Boolean);
    if (!paintedCities.length) continue;

    for (const leg of legs) {
      const { fromMismatch, toMismatch } = transportLegCityMismatch({
        leg,
        paintedCities,
        legsOnDate: legs,
      });
      const from = leg.fromCity?.trim();
      const to = leg.toCity?.trim();

      if (fromMismatch) {
        conflicts.push({
          id: `transport-from-${leg.id}-${day.date}`,
          severity: "ambiguous",
          section: "transport",
          message: `Transport on ${day.date} departs from ${from} but calendar shows ${paintedCities.join(" / ")}`,
          entityType: "transport_leg",
          entityId: leg.id,
          date: day.date,
        });
      }
      if (toMismatch) {
        conflicts.push({
          id: `transport-to-${leg.id}-${day.date}`,
          severity: "ambiguous",
          section: "transport",
          message: `Transport on ${day.date} arrives at ${to} but calendar shows ${paintedCities.join(" / ")}`,
          entityType: "transport_leg",
          entityId: leg.id,
          date: day.date,
        });
      }
    }
  }
  return conflicts;
}

export function detectUncoveredDays(graph: TripEntityGraph): EngineConflict[] {
  const bounds = effectiveTripBoundsFromState(graph);
  if (tripDatesAreUnset(bounds.startDate, bounds.endDate) && !bounds.fromContent) {
    return [];
  }
  const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
  const painted = new Set(
    mainDays.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim()).map((d) => d.date),
  );
  const conflicts: EngineConflict[] = [];
  for (const date of enumerateDates(bounds.startDate, bounds.endDate)) {
    if (!painted.has(date)) {
      conflicts.push({
        id: `uncovered-${date}`,
        severity: "ambiguous",
        section: "locations",
        message: `No location planned for ${date}`,
        date,
      });
    }
  }
  return conflicts;
}

export function detectGraphConflicts(
  graph: TripEntityGraph,
  projection: CalendarProjection,
  groupId?: string,
): EngineConflict[] {
  const gid = groupId ?? graph.mainGroupId;
  return [
    ...detectStayOverlaps(graph, gid),
    ...detectTransportCityMismatches(graph, projection),
    ...detectUncoveredDays(graph),
  ];
}
