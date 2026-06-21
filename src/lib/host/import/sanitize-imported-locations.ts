import { placesShareMetro } from "@/lib/geo/airport-codes";
import { collectFlightConnectionChains } from "@/lib/host/setup/flight-connection-chains";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { inferDayPlacesFromFlightLegs } from "@/lib/host/setup/infer-flight-calendar";
import { locationsMatch, inferStaysFromDayPlaces, enumerateDates, addDays } from "@/lib/host/wizard/location-stays";
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
      }
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function isLocationAnchor(day: DayPlaceDraft): boolean {
  if (day.secondaryCity?.trim()) return false;
  return Boolean(day.primaryCity.trim());
}

function ensureTripDayShells(
  dayPlaces: DayPlaceDraft[],
  startDate: string,
  endDate: string,
): DayPlaceDraft[] {
  const byDate = new Map(dayPlaces.map((d) => [d.date, { ...d }]));
  for (const date of enumerateDates(startDate, endDate)) {
    if (!byDate.has(date)) {
      byDate.set(date, emptyImportedDay(date));
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function isEmptyPaintDay(day: DayPlaceDraft): boolean {
  if (day.dayType === "travel" && day.secondaryCity?.trim()) return false;
  return !day.primaryCity.trim() && !day.secondaryCity?.trim();
}

function travelDestinationCity(day: DayPlaceDraft): string | null {
  if (day.dayType !== "travel") return null;
  return day.secondaryCity?.trim() || null;
}

function paintEmptyDay(day: DayPlaceDraft, city: string): DayPlaceDraft {
  return {
    ...day,
    primaryCity: city,
    secondaryCity: null,
    primaryShare: 1,
    dayType: day.dayType === "buffer" ? "buffer" : "trip",
  };
}

function extendAnchorStays(
  byDate: Map<string, DayPlaceDraft>,
  anchors: DayPlaceDraft[],
  bounds: { startDate: string; endDate: string },
): void {
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i]!;
    const city = anchor.primaryCity.trim();
    if (!city) continue;

    const nextAnchor = anchors[i + 1];
    const extendEnd =
      nextAnchor && nextAnchor.date > anchor.date
        ? addDays(nextAnchor.date, -1)
        : bounds.endDate;
    if (extendEnd < anchor.date) continue;

    for (const date of enumerateDates(anchor.date, extendEnd)) {
      const day = byDate.get(date);
      if (!day) continue;

      if (!isEmptyPaintDay(day)) {
        const travelDest = travelDestinationCity(day);
        if (travelDest && !locationsMatch(travelDest, city)) break;
        continue;
      }

      byDate.set(date, paintEmptyDay(day, city));
    }
  }
}

function backfillBeforeAnchors(
  byDate: Map<string, DayPlaceDraft>,
  anchors: DayPlaceDraft[],
  bounds: { startDate: string },
): void {
  for (const anchor of anchors) {
    const city = anchor.primaryCity.trim();
    if (!city) continue;

    for (let back = 1; back <= 4; back++) {
      const date = addDays(anchor.date, -back);
      if (date < bounds.startDate) break;

      const day = byDate.get(date);
      if (!day) continue;
      if (!isEmptyPaintDay(day)) {
        const travelDest = travelDestinationCity(day);
        if (travelDest && locationsMatch(travelDest, city)) continue;
        break;
      }

      byDate.set(date, paintEmptyDay(day, city));
    }
  }
}

function forwardFillFromTravelDays(
  byDate: Map<string, DayPlaceDraft>,
  shells: DayPlaceDraft[],
  anchors: DayPlaceDraft[],
  bounds: { endDate: string },
): void {
  for (const day of shells) {
    const dest = travelDestinationCity(day);
    if (!dest) continue;

    const matchingAnchor = anchors.find(
      (anchor) => anchor.date > day.date && locationsMatch(anchor.primaryCity, dest),
    );
    const extendEndFromAnchor = matchingAnchor
      ? addDays(matchingAnchor.date, -1)
      : bounds.endDate;
    const extendEndFromDeparture = findStayExtensionEnd(dest, day.date, shells, bounds.endDate);
    const extendEnd =
      extendEndFromDeparture < extendEndFromAnchor
        ? extendEndFromDeparture
        : extendEndFromAnchor;
    if (extendEnd <= day.date) continue;

    for (const date of enumerateDates(addDays(day.date, 1), extendEnd)) {
      const target = byDate.get(date);
      if (!target) continue;
      if (!isEmptyPaintDay(target)) break;
      byDate.set(date, paintEmptyDay(target, dest));
    }
  }
}

/** Last date still in `city` after arriving on `afterDate` (before the next move away). */
function findStayExtensionEnd(
  city: string,
  afterDate: string,
  shells: DayPlaceDraft[],
  endDate: string,
): string {
  const sorted = shells
    .filter((d) => d.date > afterDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const d of sorted) {
    const primary = d.primaryCity.trim();
    const secondary = d.secondaryCity?.trim() ?? "";

    if (d.dayType === "travel" && primary && secondary) {
      if (locationsMatch(primary, city)) {
        return addDays(d.date, -1);
      }
      continue;
    }

    if (isLocationAnchor(d) && !locationsMatch(primary, city)) {
      return addDays(d.date, -1);
    }
  }

  return endDate;
}

function paintEmptyDaysFromAccommodation(
  byDate: Map<string, DayPlaceDraft>,
  stays: AccommodationStayDraft[],
): void {
  for (const stay of stays) {
    const city = stay.cityLabel.trim();
    if (!city) continue;

    const lastNight = addDays(stay.checkOutDate, -1);
    if (lastNight < stay.checkInDate) continue;

    for (const date of enumerateDates(stay.checkInDate, lastNight)) {
      const day = byDate.get(date);
      if (!day || !isEmptyPaintDay(day)) continue;
      byDate.set(date, paintEmptyDay(day, city));
    }
  }
}

/**
 * Extend sparse arrival-only anchors across missing calendar days until the next city.
 * Then run stay-aware gap fill for partial / half-day paints.
 */
export function fillSparseCalendarAnchors(
  dayPlaces: DayPlaceDraft[],
  bounds: {
    startDate: string;
    endDate: string;
    departureCity: string;
    returnCity: string;
  },
  accommodations: AccommodationStayDraft[] = [],
): DayPlaceDraft[] {
  const shells = ensureTripDayShells(dayPlaces, bounds.startDate, bounds.endDate);
  const byDate = new Map(shells.map((d) => [d.date, { ...d }]));
  const anchors = shells.filter(isLocationAnchor).sort((a, b) => a.date.localeCompare(b.date));

  extendAnchorStays(byDate, anchors, bounds);
  backfillBeforeAnchors(byDate, anchors, bounds);
  forwardFillFromTravelDays(byDate, shells, anchors, bounds);
  paintEmptyDaysFromAccommodation(byDate, accommodations);

  return fillGapsBetweenLocationStays(
    [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    bounds,
  );
}
