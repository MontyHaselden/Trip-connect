import { placesShareMetro } from "@/lib/geo/airport-codes";
import { collectFlightConnectionChains } from "@/lib/host/setup/flight-connection-chains";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { inferDayPlacesFromFlightLegs } from "@/lib/host/setup/infer-flight-calendar";
import { locationsMatch, inferStaysFromDayPlaces, enumerateDates } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

function norm(city: string): string {
  return city.trim().toLowerCase();
}

function isHomeCity(city: string, departureCity: string, returnCity: string): boolean {
  const c = norm(city);
  if (!c) return false;
  const dep = norm(departureCity);
  const ret = norm(returnCity);
  return (dep.length > 0 && c === dep) || (ret.length > 0 && c === ret);
}

function endingCityOnDay(day: DayPlaceDraft): string {
  const secondary = day.secondaryCity?.trim() ?? "";
  const primary = day.primaryCity.trim();
  if (secondary) return secondary;
  return primary;
}

/** Home cities or one-day connection hops painted as destinations → travel splits. */
export function sanitizeImportedDayPlaces(
  dayPlaces: DayPlaceDraft[],
  ctx: { departureCity: string; returnCity: string; startDate: string; endDate: string },
): DayPlaceDraft[] {
  const sorted = [...dayPlaces].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((day, index) => {
    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";

    if (secondary || day.dayType === "travel" || !primary) return day;

    const prev = index > 0 ? sorted[index - 1]! : null;
    const next = index < sorted.length - 1 ? sorted[index + 1]! : null;
    const prevEnd = prev ? endingCityOnDay(prev) : "";
    const nextPrimary = next?.primaryCity.trim() ?? "";

    const homeTransit =
      isHomeCity(primary, ctx.departureCity, ctx.returnCity) &&
      prevEnd &&
      !isHomeCity(prevEnd, ctx.departureCity, ctx.returnCity);

    const connectionHop =
      prevEnd &&
      norm(prevEnd) !== norm(primary) &&
      ((nextPrimary && norm(nextPrimary) !== norm(primary)) ||
        isHomeCity(nextPrimary, ctx.departureCity, ctx.returnCity));

    // Outbound day at trip start — leave for flight/transfer logic.
    if (day.date <= ctx.startDate && index === 0 && !connectionHop) return day;

    if (!homeTransit && !connectionHop) return day;
    if (!prevEnd) return day;

    return {
      ...day,
      dayType: "travel",
      primaryCity: prevEnd,
      secondaryCity: primary,
      primaryShare: 0.5,
    };
  });
}

function legEndpoints(leg: TransportLegDraft | IntercityLegDraft): {
  from: string;
  to: string;
} {
  const ic = leg as IntercityLegDraft;
  const from = (ic.intercityFromCity ?? leg.fromCity).trim();
  const to = (ic.intercityToCity ?? leg.toCity).trim();
  return { from, to };
}

function legDedupeKey(leg: TransportLegDraft | IntercityLegDraft): string {
  const { from, to } = legEndpoints(leg);
  return `${leg.travelDate}|${norm(from)}|${norm(to)}|${leg.transportType}`;
}

/** Drop legs with identical endpoints (e.g. Phuket → Phuket). */
export function filterInvalidTransportLegs<T extends TransportLegDraft | IntercityLegDraft>(
  legs: T[],
): T[] {
  return legs.filter((leg) => {
    const { from, to } = legEndpoints(leg);
    if (!from || !to) return false;
    return norm(from) !== norm(to);
  });
}

/** Keep first leg per date + route + mode. */
export function dedupeTransportLegs<T extends TransportLegDraft | IntercityLegDraft>(
  legs: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const leg of legs) {
    const key = legDedupeKey(leg);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(leg);
  }
  return result;
}

function isHomeMetro(city: string, departureCity: string, returnCity: string): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;
  return (
    placesShareMetro(trimmed, departureCity) ||
    placesShareMetro(trimmed, returnCity)
  );
}

/** Drop return-direction legs AI placed on outbound days (e.g. MEL→CHC on trip start). */
export function filterMisplacedHomeDirectionLegs<
  T extends TransportLegDraft | IntercityLegDraft,
>(
  legs: T[],
  ctx: { departureCity: string; returnCity: string; startDate: string; endDate: string },
): T[] {
  return legs.filter((leg) => {
    const { from, to } = legEndpoints(leg);
    const toHome = isHomeMetro(to, ctx.departureCity, ctx.returnCity);
    if (!toHome) return true;
    if (leg.travelDate <= ctx.startDate) return false;
    if (
      leg.travelDate < ctx.endDate &&
      !isHomeMetro(from, ctx.departureCity, ctx.returnCity)
    ) {
      return false;
    }
    return true;
  });
}

/** Drop auto airport transfers that contradict same-day flight connections. */
export function filterSpuriousAutoTransfers<
  T extends TransportLegDraft | IntercityLegDraft,
>(
  legs: T[],
  ctx: { departureCity: string; returnCity: string; startDate: string; endDate: string },
  planeLegs: TransportLegDraft[],
): T[] {
  return legs.filter((leg) => {
    const ic = leg as IntercityLegDraft;
    if (ic.legKind !== "airport_arrival" && ic.legKind !== "airport_departure") return true;

    const { from, to } = legEndpoints(leg);
    const toHome = isHomeMetro(to, ctx.departureCity, ctx.returnCity);
    if (toHome && leg.travelDate <= ctx.startDate) return false;
    if (toHome && leg.travelDate < ctx.endDate) {
      const hubOutbound = planeLegs.some(
        (p) =>
          p.transportType === "plane" &&
          p.travelDate === leg.travelDate &&
          placesShareMetro(p.fromCity, from) &&
          !isHomeMetro(p.toCity, ctx.departureCity, ctx.returnCity),
      );
      if (hubOutbound) return false;
    }
    return true;
  });
}

export function sanitizeImportedTransport<T extends TransportLegDraft | IntercityLegDraft>(
  legs: T[],
): T[] {
  return dedupeTransportLegs(filterInvalidTransportLegs(legs));
}

function namedStayCoversHubOnDate(
  stays: AccommodationStayDraft[],
  date: string,
  hub: string,
): boolean {
  return stays.some((stay) => {
    if (!stay.name?.trim()) return false;
    const city = stay.cityLabel.trim();
    if (!city) return false;
    if (!placesShareMetro(city, hub) && !locationsMatch(city, hub)) return false;
    return date >= stay.checkInDate && date <= stay.checkOutDate;
  });
}

function cityMatchesHub(city: string, hub: string): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;
  return locationsMatch(trimmed, hub) || placesShareMetro(trimmed, hub);
}

/** Remove connection-hub cities AI mistook for destinations (e.g. a 4h MEL layover). */
export function stripConnectionHubsFromImportedDayPlaces(
  dayPlaces: DayPlaceDraft[],
  legs: TransportLegDraft[],
  stays: AccommodationStayDraft[] = [],
): DayPlaceDraft[] {
  const byDate = new Map(dayPlaces.map((day) => [day.date, { ...day }]));
  const chains = collectFlightConnectionChains(legs, byDate, stays);

  for (const chain of chains) {
    for (let i = 0; i < chain.legs.length - 1; i += 1) {
      const hub = metroDisplayLabel(chain.legs[i]!.toCity);
      if (!hub) continue;

      for (const [date, day] of byDate) {
        if (namedStayCoversHubOnDate(stays, date, hub)) continue;

        const primary = day.primaryCity.trim();
        const secondary = day.secondaryCity?.trim() ?? "";
        const touchesHub =
          cityMatchesHub(primary, hub) || cityMatchesHub(secondary, hub);
        if (!touchesHub) continue;

        if (primary && secondary) {
          const keepPrimary = cityMatchesHub(primary, hub) ? null : primary;
          const keepSecondary = cityMatchesHub(secondary, hub) ? null : secondary;
          if (keepPrimary && keepSecondary) {
            byDate.set(date, {
              ...day,
              primaryCity: keepPrimary,
              secondaryCity: keepSecondary,
            });
          } else if (keepPrimary) {
            byDate.set(date, {
              ...day,
              primaryCity: keepPrimary,
              secondaryCity: null,
              primaryShare: 1,
              dayType: day.dayType === "buffer" ? "buffer" : "trip",
            });
          } else if (keepSecondary) {
            byDate.set(date, {
              ...day,
              primaryCity: keepSecondary,
              secondaryCity: null,
              primaryShare: 1,
              dayType: day.dayType === "buffer" ? "buffer" : "trip",
            });
          } else {
            byDate.set(date, {
              ...day,
              primaryCity: "",
              secondaryCity: null,
              primaryShare: 1,
              dayType: day.dayType === "buffer" ? "buffer" : "trip",
            });
          }
          continue;
        }

        if (primary && cityMatchesHub(primary, hub)) {
          byDate.set(date, {
            ...day,
            primaryCity: "",
            secondaryCity: null,
            primaryShare: 1,
            dayType: day.dayType === "buffer" ? "buffer" : "trip",
          });
        }
      }
    }
  }

  return [...byDate.values()]
    .filter((day) => day.primaryCity.trim() || day.secondaryCity?.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Reconcile AI location paint with flight legs — hubs become in-flight, not stays. */
export function reconcileImportedDayPlacesWithFlights(
  dayPlaces: DayPlaceDraft[],
  legs: TransportLegDraft[],
  stays: AccommodationStayDraft[] = [],
): DayPlaceDraft[] {
  const stripped = stripConnectionHubsFromImportedDayPlaces(dayPlaces, legs, stays);
  return inferDayPlacesFromFlightLegs(stripped, legs.filter((l) => l.transportType === "plane"), {
    stays,
  });
}

function outlineDaysToPlaces(
  days: Array<{ date: string; cityLabel: string }>,
): DayPlaceDraft[] {
  return days.map((d) => ({
    date: d.date,
    primaryCity: d.cityLabel.trim(),
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip" as const,
    includeBuffer: false,
  }));
}

function emptyImportedDay(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function structurePaintOverridesOutline(day: DayPlaceDraft): boolean {
  if (day.dayType === "travel") return true;
  if (day.secondaryCity?.trim()) return true;
  return Boolean(day.primaryCity.trim());
}

/**
 * Structure import often returns sparse arrival/travel days only.
 * Keep the full per-day outline as the base and let structure override travel splits.
 */
export function mergeImportedDayPlacesWithOutline(
  structurePlaces: DayPlaceDraft[],
  outlineDays: Array<{ date: string; cityLabel: string }>,
): DayPlaceDraft[] {
  const fromOutline = outlineDaysToPlaces(outlineDays);
  if (!structurePlaces.length) return fromOutline;

  const outlineByDate = new Map(fromOutline.map((d) => [d.date, d]));
  const structureByDate = new Map(structurePlaces.map((d) => [d.date, d]));
  const allDates = [
    ...new Set([...outlineByDate.keys(), ...structureByDate.keys()]),
  ].sort();

  return allDates.map((date) => {
    const structure = structureByDate.get(date);
    const outline = outlineByDate.get(date);
    if (structure && structurePaintOverridesOutline(structure)) return structure;
    return outline ?? structure ?? emptyImportedDay(date);
  });
}

/** Paint empty days inside inferred location stays (between arrival anchors). */
export function fillGapsBetweenLocationStays(
  dayPlaces: DayPlaceDraft[],
  bounds: {
    startDate: string;
    endDate: string;
    departureCity: string;
    returnCity: string;
  },
): DayPlaceDraft[] {
  const stays = inferStaysFromDayPlaces(
    dayPlaces,
    bounds.startDate,
    bounds.endDate,
    bounds.departureCity,
    bounds.returnCity,
  );
  const byDate = new Map(dayPlaces.map((d) => [d.date, { ...d }]));

  for (const stay of stays) {
    const city = stay.location.trim();
    if (!city) continue;

    for (const date of enumerateDates(stay.startDate, stay.endDate)) {
      const day = byDate.get(date);
      if (!day) continue;
      if (day.dayType === "travel" && day.secondaryCity?.trim()) continue;

      const primary = day.primaryCity.trim();
      const secondary = day.secondaryCity?.trim() ?? "";

      if (!primary && !secondary) {
        byDate.set(date, {
          ...day,
          primaryCity: city,
          secondaryCity: null,
          primaryShare: 1,
          dayType: day.dayType === "buffer" ? "buffer" : "trip",
        });
      } else if (!primary && secondary && locationsMatch(secondary, city)) {
        byDate.set(date, {
          ...day,
          primaryCity: city,
          secondaryCity: null,
          primaryShare: 1,
          dayType: day.dayType === "buffer" ? "buffer" : "trip",
        });
      } else if (primary && locationsMatch(primary, city) && !secondary && (day.primaryShare ?? 1) < 1) {
        byDate.set(date, { ...day, primaryShare: 1, dayType: "trip" });
      }
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
