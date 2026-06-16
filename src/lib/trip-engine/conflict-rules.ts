import { airportCodeFromPlace, placesShareMetro } from "@/lib/geo/airport-codes";
import { locationsMatch } from "@/lib/host/wizard/location-stays";

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Night ranges are half-open: [checkIn, checkOut) — same-day handoff is allowed. */
export function staysOverlapNights(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Adjacent city handoff — checkout morning vs next check-in encoded a day apart. */
export function staysAreAdjacentHandoff(
  a: { checkInDate: string; checkOutDate: string; cityLabel?: string | null; name?: string | null },
  b: { checkInDate: string; checkOutDate: string; cityLabel?: string | null; name?: string | null },
  cityOf: (stay: { cityLabel?: string | null; name?: string | null }) => string,
): boolean {
  const aCity = cityOf(a);
  const bCity = cityOf(b);
  if (!aCity || !bCity || locationsMatch(aCity, bCity)) return false;

  if (a.checkOutDate === b.checkInDate || b.checkOutDate === a.checkInDate) return true;
  if (addDays(a.checkOutDate, -1) === b.checkInDate || addDays(b.checkOutDate, -1) === a.checkInDate) {
    return true;
  }
  return false;
}

export function placeMatchesCalendarCity(place: string, city: string): boolean {
  const left = place.trim();
  const right = city.trim();
  if (!left || !right) return false;
  if (locationsMatch(left, right)) return true;
  if (placesShareMetro(left, right)) return true;
  const codeA = airportCodeFromPlace(left);
  const codeB = airportCodeFromPlace(right);
  return codeA.length === 3 && codeA === codeB;
}

export function placeMatchesAnyCalendarCity(place: string, cities: string[]): boolean {
  return cities.some((city) => placeMatchesCalendarCity(place, city));
}

/** All endpoints on a travel day — painted cities plus every leg from/to (includes hubs). */
export function travelDayRoutePlaces(
  paintedCities: string[],
  legs: Array<{ fromCity?: string | null; toCity?: string | null; intercityFromCity?: string | null; intercityToCity?: string | null }>,
): string[] {
  const out = new Set<string>();
  for (const city of paintedCities) {
    if (city.trim()) out.add(city.trim());
  }
  for (const leg of legs) {
    const from = ("fromCity" in leg ? leg.fromCity : leg.intercityFromCity)?.trim();
    const to = ("toCity" in leg ? leg.toCity : leg.intercityToCity)?.trim();
    if (from) out.add(from);
    if (to) out.add(to);
  }
  return [...out];
}

function legFromCity(leg: {
  fromCity?: string | null;
  toCity?: string | null;
  intercityFromCity?: string | null;
  intercityToCity?: string | null;
}): string {
  return ("fromCity" in leg ? leg.fromCity : leg.intercityFromCity)?.trim() ?? "";
}

function legToCity(leg: {
  fromCity?: string | null;
  toCity?: string | null;
  intercityFromCity?: string | null;
  intercityToCity?: string | null;
}): string {
  return ("toCity" in leg ? leg.toCity : leg.intercityToCity)?.trim() ?? "";
}

export function transportLegCityMismatch(input: {
  leg: {
    fromCity?: string | null;
    toCity?: string | null;
    intercityFromCity?: string | null;
    intercityToCity?: string | null;
  };
  paintedCities: string[];
  legsOnDate: Array<{
    fromCity?: string | null;
    toCity?: string | null;
    intercityFromCity?: string | null;
    intercityToCity?: string | null;
  }>;
}): { fromMismatch: boolean; toMismatch: boolean } {
  const painted = input.paintedCities.filter(Boolean);
  if (!painted.length) return { fromMismatch: false, toMismatch: false };

  const routePlaces = travelDayRoutePlaces(painted, input.legsOnDate);
  const from = legFromCity(input.leg);
  const to = legToCity(input.leg);

  return {
    fromMismatch: Boolean(from && !placeMatchesAnyCalendarCity(from, routePlaces)),
    toMismatch: Boolean(to && !placeMatchesAnyCalendarCity(to, routePlaces)),
  };
}
