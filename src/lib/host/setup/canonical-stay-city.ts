import {
  isAirportPlace,
  metroKeyForPlace,
  placesShareMetro,
} from "@/lib/geo/airport-codes";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { resolveArrivalStayCity } from "@/lib/host/setup/resolve-arrival-stay-city";
import { addDays, locationsMatch } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

/** Airport names AI often puts in dayPlaces — never valid stay cities. */
const KNOWN_AIRPORT_LABELS = new Set([
  "narita",
  "haneda",
  "heathrow",
  "gatwick",
  "stansted",
  "luton",
  "schiphol",
  "changi",
  "suvarnabhumi",
  "don mueang",
  "pearson",
  "jfk",
  "laguardia",
  "newark",
]);

function normPlaceKey(place: string): string {
  return place.trim().split(",")[0]?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

/** True when a label is an airport endpoint, not a city/suburb guests stay in. */
export function isAirportEndpoint(place: string): boolean {
  const trimmed = place.trim();
  if (!trimmed) return false;
  if (isAirportPlace(trimmed)) return true;

  const key = normPlaceKey(trimmed);
  if (KNOWN_AIRPORT_LABELS.has(key)) return true;

  if (/^[a-z]{3}$/.test(key)) {
    const metro = metroKeyForPlace(trimmed);
    return Boolean(metro && metro !== key);
  }

  return false;
}

export type CanonicalStayCityContext = {
  date?: string;
  dayPlaces?: DayPlaceDraft[];
  stays?: AccommodationStayDraft[];
  planeLegs?: TransportLegDraft[];
};

function metroStayLabel(place: string): string {
  const metro = metroKeyForPlace(place);
  if (!metro) return place.split(",")[0]?.trim() || place.trim();
  return metro
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function countLabels(labels: string[]): string | null {
  const counts = new Map<string, number>();
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed || isAirportEndpoint(trimmed)) continue;
    const display = isAirportEndpoint(trimmed) ? metroStayLabel(trimmed) : metroDisplayLabel(trimmed);
    counts.set(display, (counts.get(display) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

/** Prefer the corridor city the trip already paints over a one-off hotel ward label. */
function corridorCityFromNearbyPaint(
  ward: string,
  dayPlaces: DayPlaceDraft[],
  date?: string,
): string | null {
  const labels: string[] = [];
  for (const day of dayPlaces) {
    if (date) {
      const windowStart = addDays(date, -4);
      const windowEnd = addDays(date, 4);
      if (day.date < windowStart || day.date > windowEnd) continue;
    }
    for (const raw of [day.primaryCity, day.secondaryCity ?? ""]) {
      const city = raw.trim();
      if (!city || isAirportEndpoint(city)) continue;
      labels.push(city);
    }
  }
  const ranked = countLabels(labels);
  if (!ranked || locationsMatch(ranked, ward)) return null;
  const wardCount = labels.filter((label) => locationsMatch(label, ward)).length;
  const rankedCount = labels.filter((label) => locationsMatch(label, ranked)).length;
  if (rankedCount > wardCount) return ranked;
  return null;
}

function paintedStayCitiesInMetro(
  dayPlaces: DayPlaceDraft[],
  place: string,
  aroundDate?: string,
): string[] {
  const metroKey = metroKeyForPlace(place);
  const labels: string[] = [];

  for (const day of dayPlaces) {
    if (aroundDate) {
      const windowStart = addDays(aroundDate, -4);
      const windowEnd = addDays(aroundDate, 4);
      if (day.date < windowStart || day.date > windowEnd) continue;
    }

    for (const raw of [day.primaryCity, day.secondaryCity ?? ""]) {
      const city = raw.trim();
      if (!city || isAirportEndpoint(city)) continue;
      if (placesShareMetro(city, place) || metroKeyForPlace(city) === metroKey) {
        labels.push(city);
      }
    }
  }

  return labels;
}

function stayCityFromHotels(
  place: string,
  stays: AccommodationStayDraft[],
  date?: string,
  planeLegs: TransportLegDraft[] = [],
): string | null {
  if (date) {
    const resolved = resolveArrivalStayCity(place, stays, planeLegs, date);
    if (resolved && !isAirportEndpoint(resolved)) return resolved;
  }

  const inMetro = stays.filter((stay) => {
    if (!stay.name?.trim()) return false;
    const city = stayCityLabel(stay);
    if (!city.trim()) return false;
    const targetMetro = metroKeyForPlace(place);
    return Boolean(targetMetro && metroKeyForPlace(city) === targetMetro);
  });

  if (!inMetro.length) return null;

  const labels = inMetro
    .map((stay) => stayCityLabel(stay))
    .filter((city) => city.trim() && !isAirportEndpoint(city));
  return countLabels(labels);
}

/**
 * Map airport / IATA labels to the city guests actually stay in.
 * Uses hotels, neighboring calendar days, then metro fallback.
 */
export function canonicalStayCity(
  place: string,
  ctx: CanonicalStayCityContext = {},
): string {
  const trimmed = place.trim();
  if (!trimmed) return "";

  if (!isAirportEndpoint(trimmed)) {
    const ward = trimmed.split(",")[0]?.trim() || trimmed;
    if (ctx.dayPlaces?.length) {
      const fromCorridor = corridorCityFromNearbyPaint(ward, ctx.dayPlaces, ctx.date);
      if (fromCorridor) return fromCorridor;
    }
    const fromHotels = stayCityFromHotels(
      trimmed,
      ctx.stays ?? [],
      ctx.date,
      ctx.planeLegs ?? [],
    );
    if (fromHotels) return fromStayCity(fromHotels);
    return metroDisplayLabel(trimmed);
  }

  const fromHotels = stayCityFromHotels(
    trimmed,
    ctx.stays ?? [],
    ctx.date,
    ctx.planeLegs ?? [],
  );
  if (fromHotels) return fromStayCity(fromHotels);

  if (ctx.dayPlaces?.length) {
    const nearby = paintedStayCitiesInMetro(ctx.dayPlaces, trimmed, ctx.date);
    const fromNearby = countLabels(nearby);
    if (fromNearby) return fromNearby;

    const tripWide = paintedStayCitiesInMetro(ctx.dayPlaces, trimmed);
    const fromTrip = countLabels(tripWide);
    if (fromTrip) return fromTrip;
  }

  return metroStayLabel(trimmed);
}

function fromStayCity(city: string): string {
  return metroDisplayLabel(city);
}

function normalizeCityField(
  city: string | null | undefined,
  ctx: CanonicalStayCityContext,
): string {
  const trimmed = city?.trim() ?? "";
  if (!trimmed) return "";
  return canonicalStayCity(trimmed, ctx);
}

function collapseDuplicateSplit(day: DayPlaceDraft): DayPlaceDraft {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary || !secondary) return day;
  if (!locationsMatch(primary, secondary) && !placesShareMetro(primary, secondary)) {
    return day;
  }

  const keep = primary.length >= secondary.length ? primary : secondary;
  return {
    ...day,
    primaryCity: keep,
    secondaryCity: null,
    primaryShare: 1,
    dayType: day.dayType === "travel" ? "trip" : day.dayType,
  };
}

/** Rewrite dayPlaces so airport names become stay cities (Tokyo not Haneda). */
export function normalizeDayPlacesAirports(
  dayPlaces: DayPlaceDraft[],
  ctx: CanonicalStayCityContext = {},
): DayPlaceDraft[] {
  const fullCtx: CanonicalStayCityContext = {
    ...ctx,
    dayPlaces: ctx.dayPlaces ?? dayPlaces,
  };

  return dayPlaces
    .map((day) => {
      const dateCtx = { ...fullCtx, date: day.date };
      const primary = normalizeCityField(day.primaryCity, dateCtx);
      const secondaryRaw = day.secondaryCity?.trim();
      const secondary = secondaryRaw ? normalizeCityField(secondaryRaw, dateCtx) : null;

      return collapseDuplicateSplit({
        ...day,
        primaryCity: primary,
        secondaryCity: secondary || null,
      });
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Normalize hotel city labels — airports become their stay metro. */
export function normalizeAccommodationStayCities(
  stays: AccommodationStayDraft[],
  ctx: CanonicalStayCityContext = {},
): AccommodationStayDraft[] {
  const fullCtx: CanonicalStayCityContext = { ...ctx, stays };

  return stays.map((stay) => {
    const city = stay.cityLabel?.trim() ?? "";
    if (!city || !isAirportEndpoint(city)) return stay;
    return {
      ...stay,
      cityLabel: canonicalStayCity(city, {
        ...fullCtx,
        date: stay.checkInDate,
      }),
    };
  });
}
