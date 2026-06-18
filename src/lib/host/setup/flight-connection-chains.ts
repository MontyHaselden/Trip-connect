import { placesShareMetro } from "@/lib/geo/airport-codes";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import { metroDisplayLabel } from "./metro-display";

export type FlightConnectionChain = {
  legs: TransportLegDraft[];
  /** Calendar day where the hub is skipped (last leg departs / chain connects). */
  connectionDate: string;
  /** Every leg departs and lands on connectionDate. */
  sameDay: boolean;
};

function planeLegs(legs: TransportLegDraft[]): TransportLegDraft[] {
  return legs.filter((leg) => leg.transportType === "plane");
}

function legDepartureSortKey(leg: TransportLegDraft): string {
  return `${leg.travelDate}\t${leg.departureTime ?? ""}\t${leg.id}`;
}

export function findOnwardConnectionLeg(
  legs: TransportLegDraft[],
  leg: TransportLegDraft,
): TransportLegDraft | undefined {
  const hubDate = arrivalDate(leg);
  return legs.find(
    (other) =>
      other.id !== leg.id &&
      other.transportType === "plane" &&
      other.travelDate === hubDate &&
      other.fromCity.trim() &&
      other.toCity.trim() &&
      placesShareMetro(leg.toCity, other.fromCity) &&
      !placesShareMetro(other.toCity, other.fromCity),
  );
}

export function findInboundConnectionLeg(
  legs: TransportLegDraft[],
  leg: TransportLegDraft,
): TransportLegDraft | undefined {
  const date = leg.travelDate.trim();
  if (!date) return undefined;
  return legs.find(
    (other) =>
      other.id !== leg.id &&
      other.transportType === "plane" &&
      arrivalDate(other) === date &&
      other.fromCity.trim() &&
      other.toCity.trim() &&
      placesShareMetro(other.toCity, leg.fromCity) &&
      !placesShareMetro(other.fromCity, leg.fromCity),
  );
}

export function buildConnectionChainFromLeg(
  startLeg: TransportLegDraft,
  legs: TransportLegDraft[],
): TransportLegDraft[] {
  const chain = [startLeg];
  let current = startLeg;
  while (true) {
    const onward = findOnwardConnectionLeg(legs, current);
    if (!onward) break;
    chain.push(onward);
    current = onward;
  }
  return chain;
}

function hubMetrosInChain(chain: TransportLegDraft[]): string[] {
  const hubs: string[] = [];
  for (let i = 0; i < chain.length - 1; i += 1) {
    const hub = metroDisplayLabel(chain[i]!.toCity);
    if (hub) hubs.push(hub);
  }
  return hubs;
}

function namedStayCoversHubOnDate(
  stays: AccommodationStayDraft[],
  date: string,
  hubPlace: string,
): boolean {
  return stays.some((stay) => {
    if (!stay.name?.trim()) return false;
    const city = stay.cityLabel.trim();
    if (!city) return false;
    if (!placesShareMetro(city, hubPlace) && !locationsMatch(city, hubPlace)) return false;
    return date >= stay.checkInDate && date <= stay.checkOutDate;
  });
}

function dayShowsHubStopover(
  connectionDate: string,
  day: DayPlaceDraft | undefined,
  hubPlaces: string[],
  stays: AccommodationStayDraft[],
): boolean {
  for (const hub of hubPlaces) {
    if (namedStayCoversHubOnDate(stays, connectionDate, hub)) return true;
  }

  if (!day) return false;

  const share = day.primaryShare ?? 1;
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  // Travel crossovers that touch a hub are in-flight connections, not stopovers.
  if (primary && secondary && share < 0.99) return false;

  for (const hub of hubPlaces) {
    const matchesHub =
      (primary && (locationsMatch(primary, hub) || placesShareMetro(primary, hub))) ||
      (secondary && (locationsMatch(secondary, hub) || placesShareMetro(secondary, hub)));

    if (!matchesHub) continue;

    // Full-day hub paint without a stay = intentional stopover (manual host edit).
    if (share >= 0.99 && !primary.toLowerCase().includes("airport")) return true;
  }

  return false;
}

function chainConnectionDate(chain: TransportLegDraft[]): string {
  return chain[chain.length - 1]!.travelDate.trim();
}

function isSameDayChain(chain: TransportLegDraft[], connectionDate: string): boolean {
  return chain.every(
    (leg) =>
      leg.travelDate === connectionDate && arrivalDate(leg) === connectionDate,
  );
}

/** Collapsible airport-connection chains (hub omitted unless stopover). */
export function collectFlightConnectionChains(
  legs: TransportLegDraft[],
  dayByDate: Map<string, DayPlaceDraft>,
  stays: AccommodationStayDraft[] = [],
): FlightConnectionChain[] {
  const planes = [...planeLegs(legs)].sort((a, b) =>
    legDepartureSortKey(a).localeCompare(legDepartureSortKey(b)),
  );
  const consumed = new Set<string>();
  const chains: FlightConnectionChain[] = [];

  for (const leg of planes) {
    if (consumed.has(leg.id)) continue;

    const chainLegs = buildConnectionChainFromLeg(leg, planes);
    if (chainLegs.length < 2) continue;

    const connectionDate = chainConnectionDate(chainLegs);
    const sameDay = isSameDayChain(chainLegs, connectionDate);
    const hubPlaces = hubMetrosInChain(chainLegs);
    const day = dayByDate.get(connectionDate);

    if (dayShowsHubStopover(connectionDate, day, hubPlaces, stays)) continue;

    chains.push({ legs: chainLegs, connectionDate, sameDay });
    for (const chainLeg of chainLegs) consumed.add(chainLeg.id);
  }

  return chains;
}

export function legInCollapsedChain(
  legId: string,
  chains: FlightConnectionChain[],
): FlightConnectionChain | undefined {
  return chains.find((chain) => chain.legs.some((leg) => leg.id === legId));
}

export function chainEndLeg(chain: FlightConnectionChain): TransportLegDraft {
  return chain.legs[chain.legs.length - 1]!;
}

export function chainStartLeg(chain: FlightConnectionChain): TransportLegDraft {
  return chain.legs[0]!;
}
