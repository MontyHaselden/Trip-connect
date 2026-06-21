import { placesShareMetro } from "@/lib/geo/airport-codes";
import { inferCityLabelFromAddress } from "@/lib/geo/accommodation-search";
import { metroDisplayLabel } from "@/lib/host/setup/infer-flight-calendar";
import { inferDayPlacesFromStay, normalizeInteriorStayDays } from "@/lib/host/setup-inference";
import { inferStaysFromDayPlaces, getEmptyHalf, locationsMatch } from "@/lib/host/wizard/location-stays";
import { arrivalDate, isLateArrival } from "@/lib/host/wizard/transport-day-placement";
import type { AccommodationStayDraft, DayPlaceDraft, TransportLegDraft } from "@/lib/host/wizard/types";

function staysOverlapNights(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function samePropertyNameAndCity(
  left: AccommodationStayDraft,
  right: AccommodationStayDraft,
): boolean {
  const leftName = left.name?.trim();
  const rightName = right.name?.trim();
  if (!leftName || !rightName || leftName !== rightName) return false;
  const leftCity = stayCityLabel(left);
  const rightCity = stayCityLabel(right);
  return Boolean(leftCity && rightCity && locationsMatch(leftCity, rightCity));
}

/** Same hotel + city with check-in on checkout day or the following day. */
export function samePropertyStaysAdjacent(
  left: AccommodationStayDraft,
  right: AccommodationStayDraft,
): boolean {
  if (!samePropertyNameAndCity(left, right)) return false;
  return (
    right.checkInDate === left.checkOutDate ||
    right.checkInDate === addDays(left.checkOutDate, 1)
  );
}

/** Same hotel + city when dates touch or overlap — safe to merge into one stay. */
export function samePropertyStaysMergeable(
  left: AccommodationStayDraft,
  right: AccommodationStayDraft,
): boolean {
  if (!samePropertyNameAndCity(left, right)) return false;
  if (samePropertyStaysAdjacent(left, right)) return true;
  if (samePropertyStaysAdjacent(right, left)) return true;
  return staysOverlapNights(
    left.checkInDate,
    left.checkOutDate,
    right.checkInDate,
    right.checkOutDate,
  );
}

function mergeSamePropertyStays(
  left: AccommodationStayDraft,
  right: AccommodationStayDraft,
): AccommodationStayDraft {
  return {
    ...left,
    checkInDate: left.checkInDate < right.checkInDate ? left.checkInDate : right.checkInDate,
    checkOutDate: left.checkOutDate > right.checkOutDate ? left.checkOutDate : right.checkOutDate,
  };
}

/** Merge back-to-back or overlapping stays for the same property and city. */
export function coalesceAdjacentNamedStays(
  stays: AccommodationStayDraft[],
): AccommodationStayDraft[] {
  const sorted = [...stays].sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  const merged: AccommodationStayDraft[] = [];

  for (const stay of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && samePropertyStaysMergeable(prev, stay)) {
      merged[merged.length - 1] = mergeSamePropertyStays(prev, stay);
    } else {
      merged.push(stay);
    }
  }

  return merged;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Calendar location for a stay — user region name wins over Google address inference. */
export function stayCityLabel(stay: AccommodationStayDraft): string {
  const fromLabel = stay.cityLabel?.trim();
  if (fromLabel && fromLabel.toLowerCase() !== "tbc") return fromLabel;
  if (stay.address?.trim()) {
    const fromAddress = inferCityLabelFromAddress(stay.address);
    if (fromAddress) return fromAddress;
  }
  return fromLabel ?? "";
}

/** First calendar night for hotel band — skips check-in day when a late flight lands that evening. */
export function effectiveHotelBandStart(
  stay: Pick<AccommodationStayDraft, "cityLabel" | "checkInDate">,
  planeLegs: TransportLegDraft[] = [],
): string {
  const city = stayCityLabel(stay as AccommodationStayDraft);
  if (!city || !planeLegs.length) return stay.checkInDate;

  for (const leg of planeLegs) {
    if (leg.transportType !== "plane") continue;
    const dest = metroDisplayLabel(leg.toCity);
    if (!dest || !placesShareMetro(dest, city)) continue;
    const arr = arrivalDate(leg);
    if (arr === stay.checkInDate && isLateArrival(leg)) {
      return addDays(arr, 1);
    }
  }

  return stay.checkInDate;
}

/** Hotel band for each night (evening of date → morning of date+1). */
export function accommodationLabelByDate(
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[] = [],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const stay of stays) {
    const name = stay.name?.trim();
    if (!name) continue;
    let cursor = effectiveHotelBandStart(stay, planeLegs);
    while (cursor < stay.checkOutDate) {
      map.set(cursor, name);
      cursor = addDays(cursor, 1);
    }
  }
  return map;
}

/** Hotel on the morning half of iso — night prev evening through checkout morning only. */
export function accommodationMorningHalfLabel(
  iso: string,
  stays: AccommodationStayDraft[],
): string | null {
  const prev = addDays(iso, -1);
  const match = stays
    .filter((s) => s.name?.trim())
    .find((s) => s.checkInDate <= prev && s.checkOutDate > prev);
  if (!match || iso > match.checkOutDate) return null;
  return match.name!.trim();
}

export type CalendarAccommodationBands = {
  left: string | null;
  right: string | null;
  /** Left label is checkout morning only — render half-width, not full day. */
  leftOnly?: boolean;
  /** Right label is check-in evening only — render half-width. */
  rightOnly?: boolean;
};

/** Resolve a named stay from a calendar hotel label (optional city disambiguation). */
export function namedStayForLabel(
  stays: AccommodationStayDraft[],
  label: string,
  cityHint?: string,
): AccommodationStayDraft | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const matches = stays.filter((s) => s.name?.trim() === trimmed);
  if (!matches.length) return null;
  if (cityHint?.trim()) {
    const cityMatch = matches.find((s) => locationsMatch(stayCityLabel(s), cityHint));
    if (cityMatch) return cityMatch;
  }
  return matches[0] ?? null;
}

function scopeAccommodationBandsToLocationHalf(
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare">,
  left: string | null,
  right: string | null,
): CalendarAccommodationBands {
  const emptyHalf = getEmptyHalf(day);
  if (left && !right && emptyHalf === "right") {
    return { left, right: null, leftOnly: true };
  }
  if (right && !left && emptyHalf === "left") {
    return { left: null, right, rightOnly: true };
  }
  if (left && !right && !day.primaryCity.trim() && !day.secondaryCity?.trim()) {
    return { left, right: null, leftOnly: true };
  }
  return { left, right };
}

function isSplitLocationDay(
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare">,
): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return Boolean(primary && secondary && share < 1);
}

/** Departure-side hotel on a transfer corridor — never bleed evening check-in across the whole day. */
export function corridorDepartureAccommodationLabel(
  iso: string,
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare" | "dayType">,
  stays: AccommodationStayDraft[],
  accoByDate: Map<string, string>,
): string | null {
  if (day.dayType === "buffer") return null;
  const primary = day.primaryCity.trim();
  if (!primary) return null;

  const fromDeparture = departureAccommodationLabel(iso, primary, stays);
  if (fromDeparture) return fromDeparture;

  if (!isSplitLocationDay(day)) {
    const fromDate = accoByDate.get(iso);
    if (fromDate) return fromDate;
  }

  return accommodationMorningHalfLabel(iso, stays);
}

/** Hotel bands per half — supports checkout morning + same-day check-in. */
export function accommodationBandsForCalendarDay(
  iso: string,
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare" | "dayType">,
  stays: AccommodationStayDraft[],
  accoByDate: Map<string, string>,
): CalendarAccommodationBands {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (day.dayType === "buffer") {
    return { left: null, right: null };
  }

  let left: string | null = null;
  let right: string | null = null;

  if (primary) {
    left =
      departureAccommodationLabel(iso, primary, stays) ??
      (share >= 1 ? accoByDate.get(iso) ?? null : null);
  }

  if (secondary) {
    right = arrivalAccommodationLabel(iso, secondary, stays);
  } else if (share < 1) {
    const checkoutStay = stays.find((s) => s.name?.trim() && s.checkOutDate === iso);
    const checkInStay = stays.find(
      (s) => s.name?.trim() && s.checkInDate === iso && s.checkOutDate > iso,
    );
    if (checkInStay) {
      const sameProperty =
        checkoutStay &&
        checkoutStay.id !== checkInStay.id &&
        checkoutStay.name?.trim() === checkInStay.name?.trim();
      if (!sameProperty && (checkoutStay || left)) {
        right = checkInStay.name?.trim() ?? null;
      }
    }
  }

  if (!primary && !secondary) {
    const morning = accommodationMorningHalfLabel(iso, stays);
    if (morning) {
      return { left: morning, right: null, leftOnly: true };
    }
    const night = accoByDate.get(iso) ?? null;
    if (night) left = night;
  }

  const bands = scopeAccommodationBandsToLocationHalf(day, left, right);

  const checkoutStay = stays.find((s) => s.name?.trim() && s.checkOutDate === iso);
  const checkInSameDay = stays.some(
    (s) =>
      s.name?.trim() &&
      s.checkInDate === iso &&
      s.checkOutDate > iso &&
      s.id !== checkoutStay?.id,
  );
  if (checkoutStay && bands.left && !bands.right && !checkInSameDay) {
    return { ...bands, leftOnly: true };
  }

  if (isSplitLocationDay(day)) {
    if (bands.right && !bands.left) {
      return { ...bands, rightOnly: true };
    }
    if (bands.left && !bands.right) {
      return { ...bands, leftOnly: true };
    }
  }

  return bands;
}

/** Calendar accommodation label scoped to the painted half of a split day. */
export function accommodationLabelForCalendarDay(
  iso: string,
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare" | "dayType">,
  stays: AccommodationStayDraft[],
  accoByDate: Map<string, string>,
): string | null {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (stays.length && primary && share < 1) {
    const departure = departureAccommodationLabel(iso, primary, stays);
    if (departure) return departure;
    if (secondary) return null;
  }

  if (stays.length && secondary && !primary && share < 1) {
    return arrivalAccommodationLabel(iso, secondary, stays);
  }

  if (day.dayType === "buffer") return null;

  const city = primary || secondary;
  if (city && stays.length) {
    return (
      departureAccommodationLabel(iso, city, stays) ??
      arrivalAccommodationLabel(iso, city, stays) ??
      null
    );
  }

  return (
    accoByDate.get(iso) ??
    accommodationMorningHalfLabel(iso, stays) ??
    null
  );
}

/** Hotel on the departure half of a city-change day (last night or checkout morning). */
export function departureAccommodationLabel(
  iso: string,
  departureCity: string,
  stays: AccommodationStayDraft[],
): string | null {
  const city = departureCity.trim();
  if (!city) return null;
  const match = stays
    .filter((s) => s.name?.trim())
    .find(
      (s) =>
        locationsMatch(stayCityLabel(s), city) &&
        ((s.checkInDate <= iso && s.checkOutDate > iso) || s.checkOutDate === iso),
    );
  return match?.name?.trim() ?? null;
}

/** Hotel on the arrival half — only when check-in is that same calendar date. */
export function arrivalAccommodationLabel(
  iso: string,
  arrivalCity: string,
  stays: AccommodationStayDraft[],
): string | null {
  const city = arrivalCity.trim();
  if (!city) return null;
  const match = stays
    .filter((s) => s.name?.trim())
    .find(
      (s) => s.checkInDate === iso && locationsMatch(stayCityLabel(s), city),
    );
  return match?.name?.trim() ?? null;
}

/** Align named accommodation date ranges with inferred location stays on the calendar. */
export function alignAccommodationStaysToLocationStays(
  accommodations: AccommodationStayDraft[],
  days: DayPlaceDraft[],
  tripStart: string,
  tripEnd: string,
  departureCity: string,
  returnCity: string,
): AccommodationStayDraft[] {
  const locationStays = inferStaysFromDayPlaces(
    days,
    tripStart,
    tripEnd,
    departureCity,
    returnCity,
  );

  return accommodations.map((stay) => {
    if (!stay.name?.trim()) return stay;
    const city = stayCityLabel(stay);
    const locStay = locationStays.find((ls) => locationsMatch(ls.location, city));
    if (!locStay) return stay;

    return {
      ...stay,
      checkInDate: locStay.startDate,
      checkOutDate: addDays(locStay.endDate, 1),
    };
  });
}

export function applyStaysToDayPlaces(
  dayPlaces: DayPlaceDraft[],
  stays: AccommodationStayDraft[],
  options?: { replaceStayIds?: Set<string> },
): DayPlaceDraft[] {
  let result = dayPlaces;
  for (const stay of stays) {
    const city = stayCityLabel(stay);
    if (!city) continue;
    const replaceExisting = options?.replaceStayIds?.has(stay.id) ?? false;
    result = inferDayPlacesFromStay(
      result,
      {
        cityLabel: city,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
      },
      replaceExisting ? { replaceExisting: true } : undefined,
    );
  }
  return normalizeInteriorStayDays(result, stays);
}
