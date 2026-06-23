import { placesShareMetro } from "@/lib/geo/airport-codes";
import { detectCityMoves, type CityMove } from "@/lib/host/wizard/detect-city-moves";
import { addDays, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft, IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

import { dayPlacesForGroup } from "./selectors";
import type { TripEntityGraph } from "./types";

export type PendingTransportKind = "outbound_flight" | "return_flight" | "intercity";

export type PendingTransportNeed = CityMove & {
  kind: PendingTransportKind;
};


function sortedTripDays(dayPlaces: DayPlaceDraft[]): DayPlaceDraft[] {
  return [...dayPlaces]
    .filter((day) => day.dayType !== "buffer")
    .sort((a, b) => a.date.localeCompare(b.date));
}

function sameMove(a: CityMove, b: CityMove): boolean {
  return (
    a.date === b.date &&
    locationsMatch(a.fromCity, b.fromCity) &&
    locationsMatch(a.toCity, b.toCity)
  );
}

function legEndpoints(leg: TransportLegDraft | IntercityLegDraft): { from: string; to: string } {
  const intercity = leg as IntercityLegDraft;
  return {
    from: (intercity.intercityFromCity || leg.fromCity || "").trim(),
    to: (intercity.intercityToCity || leg.toCity || "").trim(),
  };
}

function routeMatchesMove(
  from: string,
  to: string,
  move: CityMove,
): boolean {
  return (
    (locationsMatch(from, move.fromCity) || placesShareMetro(from, move.fromCity)) &&
    (locationsMatch(to, move.toCity) || placesShareMetro(to, move.toCity))
  );
}

function legCoversMove(leg: TransportLegDraft | IntercityLegDraft, move: CityMove): boolean {
  const { from, to } = legEndpoints(leg);
  if (!from || !to) return false;
  return leg.travelDate === move.date && routeMatchesMove(from, to, move);
}

function classifyMoveKind(move: CityMove, graph: TripEntityGraph): PendingTransportKind {
  const departure = graph.basics.departureCity.trim();
  const home = graph.basics.returnCity.trim();

  if (
    departure &&
    (locationsMatch(move.fromCity, departure) || placesShareMetro(move.fromCity, departure)) &&
    home &&
    !locationsMatch(move.toCity, home) &&
    !placesShareMetro(move.toCity, home)
  ) {
    return "outbound_flight";
  }

  if (
    home &&
    (locationsMatch(move.toCity, home) || placesShareMetro(move.toCity, home)) &&
    !locationsMatch(move.fromCity, home) &&
    !placesShareMetro(move.fromCity, home)
  ) {
    return "return_flight";
  }

  return "intercity";
}

/** Outbound international flight when the first trip day leaves home but no leg exists yet. */
export function detectMissingOutboundFlight(
  dayPlaces: DayPlaceDraft[],
  basics: TripEntityGraph["basics"],
): CityMove | null {
  const departure = basics.departureCity.trim();
  const startDate = basics.startDate.trim();
  if (!departure || !startDate) return null;

  const sorted = sortedTripDays(dayPlaces);
  const outboundDay = sorted.find((day) => day.date >= startDate);
  if (!outboundDay) return null;

  const primary = outboundDay.primaryCity.trim();
  const secondary = outboundDay.secondaryCity?.trim() ?? "";
  const leavesHome =
    locationsMatch(primary, departure) ||
    placesShareMetro(primary, departure) ||
    outboundDay.date <= addDays(startDate, 1);

  if (!leavesHome) return null;

  if (secondary && locationsMatch(primary, departure)) {
    return { fromCity: departure, toCity: secondary, date: outboundDay.date };
  }

  if (primary && !locationsMatch(primary, departure)) {
    return { fromCity: departure, toCity: primary, date: outboundDay.date };
  }

  if (!primary && secondary && !locationsMatch(secondary, departure)) {
    return { fromCity: departure, toCity: secondary, date: outboundDay.date };
  }

  return null;
}

function scopedTransportLegs(graph: TripEntityGraph, groupId: string) {
  const inScope = (leg: { originGroupId?: string | null }) =>
    groupId === graph.mainGroupId
      ? !leg.originGroupId || leg.originGroupId === graph.mainGroupId
      : leg.originGroupId === groupId;

  return [
    ...graph.outboundLegs.filter(inScope),
    ...graph.returnLegs.filter(inScope),
    ...graph.intercityLegs.filter(inScope),
  ];
}

function sortPendingNeeds(needs: PendingTransportNeed[]): PendingTransportNeed[] {
  const rank: Record<PendingTransportKind, number> = {
    outbound_flight: 0,
    return_flight: 1,
    intercity: 2,
  };
  return [...needs].sort((a, b) => {
    const byKind = rank[a.kind] - rank[b.kind];
    if (byKind !== 0) return byKind;
    return a.date.localeCompare(b.date);
  });
}

/** Calendar city changes and trip-edge flights that still need transport legs. */
export function pendingTransportNeedsFromCalendar(
  graph: TripEntityGraph,
  groupId: string,
): PendingTransportNeed[] {
  const dayPlaces = dayPlacesForGroup(graph, groupId);
  const moves = detectCityMoves(dayPlaces);

  const outbound = detectMissingOutboundFlight(dayPlaces, graph.basics);
  if (outbound && !moves.some((move) => sameMove(move, outbound))) {
    moves.unshift(outbound);
  }

  const legs = scopedTransportLegs(graph, groupId);
  const uncovered = moves.filter((move) => !legs.some((leg) => legCoversMove(leg, move)));

  return sortPendingNeeds(
    uncovered.map((move) => ({
      ...move,
      kind: classifyMoveKind(move, graph),
    })),
  );
}

/** @deprecated Use pendingTransportNeedsFromCalendar */
export function pendingCityMovesFromCalendar(
  graph: TripEntityGraph,
  groupId: string,
): CityMove[] {
  return pendingTransportNeedsFromCalendar(graph, groupId).filter(
    (need) => need.kind === "intercity",
  );
}

export function cityMoveToPlaceholderLeg(
  move: CityMove,
  groupId: string,
  kind: PendingTransportKind = "intercity",
): IntercityLegDraft {
  const transportType = kind === "intercity" ? "unsure" : "plane";
  return {
    id: newId(),
    transportType,
    bookingStatus: kind === "intercity" ? "flexible" : "placeholder",
    travelDate: move.date,
    arrivalDate: move.date,
    departureTime: null,
    arrivalTime: null,
    fromCity: move.fromCity,
    toCity: move.toCity,
    fromStation: move.fromCity,
    toStation: move.toCity,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    intercityFromCity: move.fromCity,
    intercityToCity: move.toCity,
    legKind: kind === "intercity" ? "city_change" : undefined,
    originGroupId: groupId,
    sourceEntityId: null,
  };
}

export function pendingNeedLabel(need: PendingTransportNeed): string {
  switch (need.kind) {
    case "outbound_flight":
      return "Outbound flight";
    case "return_flight":
      return "Return flight";
    default:
      return "City change";
  }
}
