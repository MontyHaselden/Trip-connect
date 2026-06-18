import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { isAirportPlace, placesShareMetro } from "@/lib/geo/airport-codes";
import {
  chainEndLeg,
  chainStartLeg,
  collectFlightConnectionChains,
  legInCollapsedChain,
  type FlightConnectionChain,
} from "@/lib/host/setup/flight-connection-chains";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { resolveArrivalStayCity } from "@/lib/host/setup/resolve-arrival-stay-city";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import {
  DEFAULT_HALF_SHARE,
  addDays,
} from "@/lib/host/wizard/location-stays";
import {
  arrivalDate,
  departureDayCityEndShare,
  flightTimeShare,
  isLateArrival,
} from "@/lib/host/wizard/transport-day-placement";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

const CROSSOVER_LEFT = 0.25;

export { metroDisplayLabel } from "@/lib/host/setup/metro-display";

function emptyDay(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

export function dayHasStayPaint(day: DayPlaceDraft): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary && !secondary) return false;
  if (primary && !isAirportPlace(primary)) return true;
  if (secondary && !isAirportPlace(secondary)) return true;
  return false;
}

function citiesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function namedStayInMetroOnDate(
  stays: AccommodationStayDraft[],
  metro: string,
  date: string,
): boolean {
  const hub = metro.trim();
  if (!hub) return false;
  return stays.some((stay) => {
    if (!stay.name?.trim()) return false;
    const city = stay.cityLabel.trim();
    if (!city) return false;
    if (!placesShareMetro(city, hub) && !citiesMatch(city, hub)) return false;
    return date >= stay.checkInDate && date < stay.checkOutDate;
  });
}

/** Connection hubs on overnight departures are not stay cities (e.g. BKK→MEL, not a Melbourne stay). */
function stripHubPaintOnOvernightDepartureDays(
  dayPlaces: DayPlaceDraft[],
  legs: TransportLegDraft[],
  stays: AccommodationStayDraft[],
): DayPlaceDraft[] {
  const named = stays.filter((s) => s.name?.trim());
  const byDate = new Map(dayPlaces.map((d) => [d.date, d]));

  for (const leg of legs) {
    if (leg.transportType !== "plane") continue;
    const dep = leg.travelDate.trim();
    const arr = arrivalDate(leg);
    if (!dep || arr <= dep) continue;

    const hubMetro = metroDisplayLabel(leg.toCity);
    if (!hubMetro) continue;

    const day = byDate.get(dep);
    if (!day) continue;

    const secondary = day.secondaryCity?.trim() ?? "";
    if (!secondary) continue;
    if (!placesShareMetro(secondary, hubMetro) && !citiesMatch(secondary, hubMetro)) continue;

    if (
      namedStayInMetroOnDate(named, hubMetro, dep) ||
      namedStayInMetroOnDate(named, hubMetro, arr)
    ) {
      continue;
    }

    const cityShare = departureDayCityEndShare(
      leg.departureTime,
      flightTimeShare(leg.departureTime, CROSSOVER_LEFT),
    );
    byDate.set(dep, {
      ...day,
      secondaryCity: null,
      primaryShare: Math.max(day.primaryShare ?? 1, cityShare),
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Checkout departure days: city paint should reach the evening flight band. */
function alignOvernightDepartureCityShare(
  dayPlaces: DayPlaceDraft[],
  legs: TransportLegDraft[],
): DayPlaceDraft[] {
  const byDate = new Map(dayPlaces.map((d) => [d.date, d]));

  for (const leg of legs) {
    if (leg.transportType !== "plane") continue;
    const dep = leg.travelDate.trim();
    const arr = arrivalDate(leg);
    if (!dep || arr <= dep) continue;

    const day = byDate.get(dep);
    if (!day?.primaryCity.trim() || day.secondaryCity?.trim()) continue;

    const cityShare = departureDayCityEndShare(
      leg.departureTime,
      flightTimeShare(leg.departureTime, CROSSOVER_LEFT),
    );
    if ((day.primaryShare ?? 1) + 0.01 < cityShare) {
      byDate.set(dep, { ...day, primaryShare: cityShare });
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function paintOriginBeforeDeparture(
  day: DayPlaceDraft,
  origin: string,
  departureShare: number,
  departureTime?: string | null,
): DayPlaceDraft {
  const share = departureDayCityEndShare(
    departureTime ?? null,
    Math.min(Math.max(departureShare, CROSSOVER_LEFT), 1),
  );
  if (dayHasStayPaint(day)) {
    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    if (primary && !isAirportPlace(primary) && !secondary) {
      return { ...day, primaryShare: Math.min(day.primaryShare ?? 1, share) };
    }
    return day;
  }
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  if (primary && citiesMatch(primary, origin)) return day;
  if (secondary && citiesMatch(secondary, origin)) return day;

  if (!primary && !secondary) {
    return {
      ...day,
      primaryCity: origin,
      secondaryCity: null,
      primaryShare: share,
      dayType: "trip",
    };
  }

  if (!secondary) {
    return {
      ...day,
      primaryCity: origin,
      secondaryCity: primary !== origin ? primary : null,
      primaryShare: share,
      dayType: "trip",
    };
  }

  return day;
}

function paintDestinationAfterArrival(
  day: DayPlaceDraft,
  dest: string,
  arrivalShare: number,
): DayPlaceDraft {
  if (dayHasStayPaint(day)) return day;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = Math.min(Math.max(arrivalShare, CROSSOVER_LEFT), 1);

  if (secondary && citiesMatch(secondary, dest)) return day;
  if (primary && citiesMatch(primary, dest) && !secondary) {
    return { ...day, primaryShare: Math.min(day.primaryShare, share) };
  }

  if (!primary && !secondary) {
    return {
      ...day,
      primaryCity: dest,
      secondaryCity: null,
      primaryShare: share,
      dayType: "trip",
    };
  }

  if (primary && !secondary) {
    return {
      ...day,
      primaryCity: dest,
      secondaryCity: null,
      primaryShare: share,
      dayType: "trip",
    };
  }

  if (secondary && citiesMatch(secondary, dest)) {
    return {
      ...day,
      primaryCity: dest,
      secondaryCity: null,
      primaryShare: share,
      dayType: "trip",
    };
  }

  return day;
}

function paintTimedCrossoverDay(
  day: DayPlaceDraft,
  fromCity: string,
  toCity: string,
  departureShare: number,
): DayPlaceDraft {
  if (dayHasStayPaint(day)) return day;
  const left = Math.min(Math.max(departureShare, 0.05), 0.95);
  return {
    ...day,
    primaryCity: fromCity,
    secondaryCity: toCity,
    primaryShare: left,
    dayType: "trip",
    includeBuffer: false,
  };
}

function resolveDestCity(
  leg: TransportLegDraft,
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[],
): string {
  const arr = arrivalDate(leg);
  return resolveArrivalStayCity(leg.toCity, stays, planeLegs, arr || leg.travelDate);
}

function applyConnectionChainPaint(
  byDate: Map<string, DayPlaceDraft>,
  chain: FlightConnectionChain,
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[],
): void {
  const first = chainStartLeg(chain);
  const last = chainEndLeg(chain);
  const origin = metroDisplayLabel(first.fromCity);
  const dest = resolveDestCity(last, stays, planeLegs);
  if (!origin || !dest || locationsMatch(origin, dest)) return;

  const { connectionDate, sameDay } = chain;
  const day = byDate.get(connectionDate) ?? emptyDay(connectionDate);
  if (dayHasStayPaint(day)) return;

  if (sameDay) {
    const depShare = flightTimeShare(first.departureTime, CROSSOVER_LEFT);
    byDate.set(connectionDate, paintTimedCrossoverDay(day, origin, dest, depShare));
    return;
  }

  const arrShare = flightTimeShare(last.arrivalTime, CROSSOVER_LEFT);
  byDate.set(connectionDate, paintDestinationAfterArrival(day, dest, arrShare));

  const depDate = first.travelDate.trim();
  if (!sameDay && depDate && origin && depDate !== connectionDate) {
    const depDay = byDate.get(depDate) ?? emptyDay(depDate);
    if (!dayHasStayPaint(depDay)) {
      const depShare = flightTimeShare(first.departureTime, DEFAULT_HALF_SHARE);
      byDate.set(
        depDate,
        paintOriginBeforeDeparture(depDay, origin, depShare, first.departureTime),
      );
    }
  }
}

function shouldSkipLegPaintOnDate(
  leg: TransportLegDraft,
  date: string,
  chain: FlightConnectionChain | undefined,
): boolean {
  if (!chain) return false;
  if (date !== chain.connectionDate) return false;
  if (!chain.legs.some((chainLeg) => chainLeg.id === leg.id)) return false;

  const dep = leg.travelDate.trim();
  const arr = arrivalDate(leg);
  const isHubLeg =
    chain.legs.findIndex((chainLeg) => chainLeg.id === leg.id) < chain.legs.length - 1;

  if (chain.sameDay) return true;

  if (arr === date && isHubLeg) return true;
  if (dep === date && leg.id !== chain.legs[0]!.id) return true;
  if (dep === arr && dep === date) return true;

  return leg.id === chainEndLeg(chain).id;
}

function applyLegPaint(
  byDate: Map<string, DayPlaceDraft>,
  leg: TransportLegDraft,
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[],
  chain?: FlightConnectionChain,
): void {
  if (leg.transportType !== "plane") return;

  const origin = metroDisplayLabel(leg.fromCity);
  const dest = resolveDestCity(leg, stays, planeLegs);
  if (!origin && !dest) return;

  const dep = leg.travelDate?.trim();
  const arr = arrivalDate(leg);
  if (!dep) return;

  const depShare = flightTimeShare(leg.departureTime, CROSSOVER_LEFT);
  const arrShare = flightTimeShare(leg.arrivalTime, CROSSOVER_LEFT);

  if (
    dep === arr &&
    origin &&
    dest &&
    !locationsMatch(origin, dest) &&
    !shouldSkipLegPaintOnDate(leg, dep, chain)
  ) {
    const day = byDate.get(dep) ?? emptyDay(dep);
    byDate.set(dep, paintTimedCrossoverDay(day, origin, dest, depShare));
    return;
  }

  if (origin && !shouldSkipLegPaintOnDate(leg, dep, chain)) {
    const depDay = byDate.get(dep) ?? emptyDay(dep);
    byDate.set(
      dep,
      paintOriginBeforeDeparture(depDay, origin, depShare, leg.departureTime),
    );
  }

  if (dest && arr && !shouldSkipLegPaintOnDate(leg, arr, chain)) {
    const arrDay = byDate.get(arr) ?? emptyDay(arr);
    byDate.set(arr, paintDestinationAfterArrival(arrDay, dest, arrShare));

    if (isLateArrival(leg)) {
      const morningDate = addDays(arr, 1);
      const morningDay = byDate.get(morningDate) ?? emptyDay(morningDate);
      byDate.set(morningDate, paintDestinationAfterArrival(morningDay, dest, DEFAULT_HALF_SHARE));
    }
  }
}

/** Calendar dates a plane leg paints (departure, arrival evening, next morning). */
export function planeLegCalendarDates(leg: TransportLegDraft): string[] {
  if (leg.transportType !== "plane") return [];
  const dep = leg.travelDate?.trim();
  if (!dep) return [];
  const arr = arrivalDate(leg);
  const dates = new Set<string>([dep]);
  if (arr) dates.add(arr);
  if (arr && arr !== dep && isLateArrival(leg)) dates.add(addDays(arr, 1));
  return [...dates];
}

function namedStayCoversDate(
  stays: AccommodationStayDraft[],
  date: string,
): boolean {
  return stays.some(
    (stay) =>
      stay.name?.trim() &&
      date >= stay.checkInDate &&
      date <= stay.checkOutDate,
  );
}

function isAccommodationGapEdgeDay(
  day: DayPlaceDraft,
  stays: AccommodationStayDraft[],
): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary && !secondary) return false;

  for (const stay of stays) {
    if (!stay.name?.trim()) continue;
    const city = stay.cityLabel.trim();
    if (!city) continue;

    if (day.date === stay.checkOutDate && locationsMatch(primary, city)) {
      return true;
    }
    if (
      day.date === addDays(stay.checkInDate, -1) &&
      (locationsMatch(primary, city) || locationsMatch(secondary, city))
    ) {
      return true;
    }
  }

  return false;
}

export function isExplicitHostLocationPaint(
  day: DayPlaceDraft,
  namedStays: AccommodationStayDraft[],
): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  if (!primary && !secondary) return false;
  if (isAirportPlace(primary) || isAirportPlace(secondary)) return false;
  // Travel crossovers (origin/destination halves) are flight paint, not host gap fill.
  if (primary && secondary && share < 0.99) return false;

  if (primary && !secondary && share >= 0.99 && !namedStayCoversDate(namedStays, day.date)) {
    return true;
  }

  if (secondary && !namedStayCoversDate(namedStays, day.date)) {
    return !namedStays.some(
      (stay) => stay.name?.trim() && locationsMatch(stayCityLabel(stay), secondary),
    );
  }

  return false;
}

/** Remove flight-only paint on days no current plane leg touches. */
export function stripOrphanFlightPaint(
  dayPlaces: DayPlaceDraft[],
  legs: TransportLegDraft[],
  namedStays: AccommodationStayDraft[] = [],
): DayPlaceDraft[] {
  const planeLegs = legs.filter((l) => l.transportType === "plane");
  const touched = new Set(
    planeLegs.flatMap((leg) => planeLegCalendarDates(leg)),
  );

  return dayPlaces
    .map((day) => {
      if (namedStayCoversDate(namedStays, day.date)) return day;
      if (isAccommodationGapEdgeDay(day, namedStays)) return day;
      if (isExplicitHostLocationPaint(day, namedStays)) return day;
      if (touched.has(day.date)) return day;
      if (!day.primaryCity.trim() && !day.secondaryCity?.trim()) return day;
      return emptyDay(day.date);
    })
    .filter((day) => day.primaryCity.trim() || day.secondaryCity?.trim());
}

export type InferFlightCalendarOptions = {
  stays?: AccommodationStayDraft[];
};

/** Paint origin / destination metros from plane legs without clobbering stay paint. */
export function inferDayPlacesFromFlightLegs(
  dayPlaces: DayPlaceDraft[],
  legs: TransportLegDraft[],
  options?: InferFlightCalendarOptions,
): DayPlaceDraft[] {
  const byDate = new Map(dayPlaces.map((d) => [d.date, { ...d }]));
  const stays = options?.stays ?? [];
  const planeLegs = legs.filter((l) => l.transportType === "plane");
  const chains = collectFlightConnectionChains(legs, byDate, stays);

  for (const chain of chains) {
    applyConnectionChainPaint(byDate, chain, stays, planeLegs);
  }

  for (const leg of legs) {
    applyLegPaint(byDate, leg, stays, planeLegs, legInCollapsedChain(leg.id, chains));
  }

  const dates = new Set([...byDate.keys(), ...dayPlaces.map((d) => d.date)]);
  let result = [...dates]
    .sort()
    .map((date) => byDate.get(date) ?? emptyDay(date));

  result = stripHubPaintOnOvernightDepartureDays(result, legs, stays);
  result = alignOvernightDepartureCityShare(result, legs);
  return result;
}

export function allPlaneLegsFromState(input: {
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  intercityLegs: TransportLegDraft[];
}): TransportLegDraft[] {
  return [
    ...input.outboundLegs,
    ...input.intercityLegs.filter((l) => l.transportType === "plane"),
    ...input.returnLegs,
  ];
}
