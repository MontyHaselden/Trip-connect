import { placesShareMetro } from "@/lib/geo/airport-codes";
import { detectCityMoves, type CityMove } from "@/lib/host/wizard/detect-city-moves";
import { addDays, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft, IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

import {
  isPendingTransportNeedHidden,
  pendingTransportNeedKey,
} from "./hidden-pending-transport";
import { personalGroupForGroupId } from "./person-lens";
import { projectCalendar } from "./project-calendar";
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

function isFlightLeg(leg: TransportLegDraft | IntercityLegDraft): boolean {
  return leg.transportType === "plane";
}

/** Flights may depart the day before the calendar arrival split. */
function legDatesAlignWithMove(leg: TransportLegDraft | IntercityLegDraft, move: CityMove): boolean {
  if (leg.travelDate === move.date) return true;
  if (!isFlightLeg(leg)) return false;
  const arrival = leg.arrivalDate?.trim();
  if (arrival && arrival === move.date) return true;
  if (addDays(leg.travelDate, 1) === move.date) return true;
  if (addDays(move.date, 1) === leg.travelDate) return true;
  return false;
}

function legCoversMove(leg: TransportLegDraft | IntercityLegDraft, move: CityMove): boolean {
  const { from, to } = legEndpoints(leg);
  if (!from || !to) return false;
  return legDatesAlignWithMove(leg, move) && routeMatchesMove(from, to, move);
}

function isMainOwnedLeg(
  leg: { originGroupId?: string | null },
  mainGroupId: string,
): boolean {
  return !leg.originGroupId || leg.originGroupId === mainGroupId;
}

function projectedDayToDraft(day: {
  date: string;
  primaryCity: string;
  secondaryCity: string | null;
  primaryShare: number;
  dayType: DayPlaceDraft["dayType"];
}): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: day.primaryCity,
    secondaryCity: day.secondaryCity,
    primaryShare: day.primaryShare,
    dayType: day.dayType,
    includeBuffer: false,
  };
}

/** Same calendar the host sees when checking gaps for a group. */
function dayPlacesForPendingTransport(graph: TripEntityGraph, groupId: string): DayPlaceDraft[] {
  if (groupId === graph.mainGroupId) {
    return dayPlacesForGroup(graph, groupId);
  }
  const personal = personalGroupForGroupId(graph, groupId);
  if (personal?.inheritMode === "overlay") {
    return projectCalendar(graph, { groupId }).days.map(projectedDayToDraft);
  }
  return dayPlacesForGroup(graph, groupId);
}

function isHomeCity(city: string, basics: TripEntityGraph["basics"]): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;
  const home = basics.returnCity.trim() || basics.departureCity.trim();
  if (!home) return false;
  return locationsMatch(trimmed, home) || placesShareMetro(trimmed, home);
}

function homeCityLabel(basics: TripEntityGraph["basics"]): string {
  return basics.returnCity.trim() || basics.departureCity.trim();
}

function classifyMoveKind(move: CityMove, graph: TripEntityGraph): PendingTransportKind {
  const from = move.fromCity.trim();
  const to = move.toCity.trim();
  const fromHome = isHomeCity(from, graph.basics);
  const toHome = isHomeCity(to, graph.basics);

  if (fromHome && !toHome) return "outbound_flight";
  if (toHome && !fromHome) return "return_flight";
  return "intercity";
}

/** Outbound international flight when the first trip day leaves home but no leg exists yet. */
export function detectMissingOutboundFlight(
  dayPlaces: DayPlaceDraft[],
  basics: TripEntityGraph["basics"],
): CityMove | null {
  const startDate = basics.startDate.trim();
  const home = homeCityLabel(basics);
  if (!startDate || !home) return null;

  const sorted = sortedTripDays(dayPlaces);
  const outboundDay = sorted.find((day) => day.date >= startDate);
  if (!outboundDay) return null;

  const primary = outboundDay.primaryCity.trim();
  const secondary = outboundDay.secondaryCity?.trim() ?? "";
  const primaryIsHome = primary ? isHomeCity(primary, basics) : false;
  const secondaryIsHome = secondary ? isHomeCity(secondary, basics) : false;

  const involvesLeavingHome =
    primaryIsHome || outboundDay.date <= addDays(startDate, 1);
  if (!involvesLeavingHome) return null;

  // Travel split: home on the left, destination on the right.
  if (secondary && primaryIsHome && !secondaryIsHome) {
    return { fromCity: primary || home, toCity: secondary, date: outboundDay.date };
  }

  // Land abroad (destination city on the calendar without a home split).
  if (primary && !primaryIsHome) {
    return { fromCity: home, toCity: primary, date: outboundDay.date };
  }

  if (!primary && secondary && !secondaryIsHome) {
    return { fromCity: home, toCity: secondary, date: outboundDay.date };
  }

  return null;
}

function scopedTransportLegs(graph: TripEntityGraph, groupId: string) {
  const personal = personalGroupForGroupId(graph, groupId);
  const inheritsMainTransport = personal?.inheritMode === "overlay";
  const legs: Array<TransportLegDraft | IntercityLegDraft> = [];

  if (groupId === graph.mainGroupId || inheritsMainTransport) {
    legs.push(
      ...graph.outboundLegs.filter((leg) => isMainOwnedLeg(leg, graph.mainGroupId)),
      ...graph.returnLegs.filter((leg) => isMainOwnedLeg(leg, graph.mainGroupId)),
    );
  }

  if (groupId === graph.mainGroupId) {
    legs.push(
      ...graph.intercityLegs.filter((leg) => isMainOwnedLeg(leg, graph.mainGroupId)),
    );
  } else {
    legs.push(...graph.intercityLegs.filter((leg) => leg.originGroupId === groupId));
    if (inheritsMainTransport) {
      legs.push(
        ...graph.intercityLegs.filter((leg) => isMainOwnedLeg(leg, graph.mainGroupId)),
      );
    }
  }

  return legs;
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
  options?: { includeHidden?: boolean },
): PendingTransportNeed[] {
  const dayPlaces = dayPlacesForPendingTransport(graph, groupId);
  const moves = detectCityMoves(dayPlaces);

  const outbound = detectMissingOutboundFlight(dayPlaces, graph.basics);
  if (outbound && !moves.some((move) => sameMove(move, outbound))) {
    moves.unshift(outbound);
  }

  const legs = scopedTransportLegs(graph, groupId);
  const uncovered = moves.filter((move) => !legs.some((leg) => legCoversMove(leg, move)));

  const needs = sortPendingNeeds(
    uncovered.map((move) => ({
      ...move,
      kind: classifyMoveKind(move, graph),
    })),
  );

  if (options?.includeHidden) return needs;

  const hiddenKeys = new Set(graph.hiddenPendingTransportNeedKeys ?? []);
  return needs.filter((need) => !isPendingTransportNeedHidden(hiddenKeys, groupId, need));
}

/** Hidden calendar transport suggestions the host dismissed from the transport list. */
export function hiddenPendingTransportNeedsFromCalendar(
  graph: TripEntityGraph,
  groupId: string,
): PendingTransportNeed[] {
  const hiddenKeys = new Set(graph.hiddenPendingTransportNeedKeys ?? []);
  if (hiddenKeys.size === 0) return [];

  return pendingTransportNeedsFromCalendar(graph, groupId, { includeHidden: true }).filter(
    (need) => isPendingTransportNeedHidden(hiddenKeys, groupId, need),
  );
}

export { pendingTransportNeedKey };

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
