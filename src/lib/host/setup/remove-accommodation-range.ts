import { applyStaysToDayPlaces, stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { stayDatesForSelection } from "@/lib/host/setup/day-selection-setup";
import { clearAllLocationInSpan } from "@/lib/trip-engine/paint-day-range";
import {
  clearPersonalOverlayLocationInSpan,
  isPersonalOverlayGroup,
} from "@/lib/trip-engine/personal-location-overlay";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import {
  groupAccommodationStays,
  mainAccommodationStays,
  mergeAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import type { TripSetupState } from "@/lib/host/setup/types";
import { nightDatesForRemoval } from "@/lib/host/setup/night-pair-selection";
import {
  DEFAULT_HALF_SHARE,
  addDays,
  enumerateDates,
  locationsMatch,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

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

function endingCityOnDay(day: DayPlaceDraft): string {
  const secondary = day.secondaryCity?.trim() ?? "";
  const primary = day.primaryCity.trim();
  return secondary || primary;
}

function startingCityOnDay(day: DayPlaceDraft): string {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary && secondary) return secondary;
  return primary || secondary;
}

function citiesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function departureEdgeDay(date: string, city: string): DayPlaceDraft {
  return {
    date,
    primaryCity: city,
    secondaryCity: null,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: "trip",
    includeBuffer: false,
  };
}

function arrivalEdgeDay(date: string, city: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: city,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: "travel",
    includeBuffer: false,
  };
}

/** Split or remove named stays that overlap a cleared date range. */
export function splitStaysForRangeRemoval(
  stays: AccommodationStayDraft[],
  rangeStart: string,
  rangeEnd: string,
): AccommodationStayDraft[] {
  const result: AccommodationStayDraft[] = [];

  for (const stay of stays) {
    if (!stay.name?.trim()) {
      result.push(stay);
      continue;
    }

    const overlaps = stay.checkInDate <= rangeEnd && stay.checkOutDate > rangeStart;
    if (!overlaps) {
      result.push(stay);
      continue;
    }

    const rangeAfterEnd = addDays(rangeEnd, 1);

    if (rangeStart > stay.checkInDate && rangeEnd < addDays(stay.checkOutDate, -1)) {
      result.push({ ...stay, checkOutDate: rangeStart });
      result.push({
        ...stay,
        id: newId(),
        checkInDate: rangeAfterEnd,
      });
      continue;
    }

    if (rangeStart <= stay.checkInDate && rangeEnd < addDays(stay.checkOutDate, -1)) {
      result.push({ ...stay, checkInDate: rangeAfterEnd });
      continue;
    }

    if (rangeStart > stay.checkInDate && rangeEnd >= addDays(stay.checkOutDate, -1)) {
      result.push({ ...stay, checkOutDate: rangeStart });
      continue;
    }

    // Entire stay covered by range — omit
  }

  return result;
}

/** Shorten or split named stays that overlap a new location paint with a different city. */
export function trimConflictingStaysForLocationPaint(
  stays: AccommodationStayDraft[],
  location: string,
  rangeStart: string,
  rangeEnd: string,
): AccommodationStayDraft[] {
  const end = rangeEnd || rangeStart;
  const matching = stays.filter(
    (stay) => stay.name?.trim() && locationsMatch(stayCityLabel(stay), location),
  );
  const other = stays.filter((stay) => !stay.name?.trim() || !locationsMatch(stayCityLabel(stay), location));
  const trimmedNamed = splitStaysForRangeRemoval(
    other.filter((stay) => stay.name?.trim()),
    rangeStart,
    end,
  );
  return [...matching, ...trimmedNamed, ...other.filter((stay) => !stay.name?.trim())];
}

function paintRangeGaps(
  existing: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
): DayPlaceDraft[] {
  const byDate = new Map(existing.map((d) => [d.date, d]));
  const dates = enumerateDates(rangeStart, rangeEnd);
  const isSingleDay = rangeStart === rangeEnd;

  for (const date of dates) {
    const isFirst = date === rangeStart;
    const isLast = date === rangeEnd;
    const isInterior = !isSingleDay && !isFirst && !isLast;

    if (isInterior || (isSingleDay && dates.length === 1)) {
      if (isSingleDay) {
        const prev = byDate.get(addDays(date, -1));
        const next = byDate.get(addDays(date, 1));
        const prevCity = prev ? endingCityOnDay(prev) : "";
        const nextCity = next ? startingCityOnDay(next) : "";

        if (prevCity && nextCity && citiesMatch(prevCity, nextCity)) {
          byDate.set(date, emptyDay(date));
        } else if (prevCity && (!nextCity || !citiesMatch(prevCity, nextCity))) {
          byDate.set(date, departureEdgeDay(date, prevCity));
        } else if (nextCity) {
          byDate.set(date, arrivalEdgeDay(date, nextCity));
        } else {
          byDate.set(date, emptyDay(date));
        }
      } else {
        byDate.set(date, emptyDay(date));
      }
      continue;
    }

    if (isFirst && !isSingleDay) {
      const prevDate = addDays(date, -1);
      if (prevDate >= rangeStart) {
        byDate.set(date, emptyDay(date));
      } else {
        const prev = byDate.get(prevDate);
        const prevCity = prev ? endingCityOnDay(prev) : "";
        byDate.set(date, prevCity ? departureEdgeDay(date, prevCity) : emptyDay(date));
      }
      continue;
    }

    if (isLast && !isSingleDay) {
      const nextDate = addDays(date, 1);
      if (nextDate <= rangeEnd) {
        byDate.set(date, emptyDay(date));
      } else {
        const next = byDate.get(nextDate);
        const nextCity = next ? startingCityOnDay(next) : "";
        byDate.set(date, nextCity ? arrivalEdgeDay(date, nextCity) : emptyDay(date));
      }
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function legOwnedByGroup(
  leg: { originGroupId?: string | null },
  groupId: string,
  mainGroupId: string,
): boolean {
  if (!leg.originGroupId || leg.originGroupId === mainGroupId) {
    return groupId === mainGroupId;
  }
  return leg.originGroupId === groupId;
}

function removeIntercityLegsOnDates(
  state: TripSetupState,
  dates: Set<string>,
  groupId: string,
): TripSetupState {
  const intercityLegs = state.intercityLegs.filter(
    (leg) =>
      !dates.has(leg.travelDate) ||
      !legOwnedByGroup(leg, groupId, state.mainGroupId),
  );
  return { ...state, intercityLegs };
}

function staysChanged(
  before: AccommodationStayDraft[],
  after: AccommodationStayDraft[],
): boolean {
  if (before.length !== after.length) return true;
  const beforeById = new Map(before.map((stay) => [stay.id, stay]));
  for (const stay of after) {
    const prev = beforeById.get(stay.id);
    if (!prev) return true;
    if (
      prev.checkInDate !== stay.checkInDate ||
      prev.checkOutDate !== stay.checkOutDate ||
      prev.cityLabel !== stay.cityLabel ||
      (prev.name?.trim() ?? "") !== (stay.name?.trim() ?? "")
    ) {
      return true;
    }
  }
  return false;
}

/** Remove named accommodation and city labels across a selected date range. */
export function removeAccommodationAndCitiesFromRange(
  state: TripSetupState,
  rangeStart: string,
  rangeEnd: string,
  groupId: string,
  options?: {
    startHalf?: HalfSide | "full";
    endHalf?: HalfSide | "full";
  },
): TripSetupState {
  const halfSelection = {
    rangeStart,
    rangeEnd,
    startHalf: options?.startHalf ?? "full",
    endHalf: options?.endHalf ?? "full",
  };
  const nightSpan = nightDatesForRemoval(halfSelection);
  const locationSpan = stayDatesForSelection(halfSelection);
  rangeStart = nightSpan.rangeStart;
  rangeEnd = nightSpan.rangeEnd;
  const locationClearStart = locationSpan.checkIn;
  const locationClearEnd = locationSpan.checkOut;

  const isMain = groupId === state.mainGroupId;
  const scopedStays = isMain
    ? mainAccommodationStays(state)
    : groupAccommodationStays(state, groupId);

  const remainingStays = splitStaysForRangeRemoval(scopedStays, rangeStart, rangeEnd);
  const staysWereModified = staysChanged(scopedStays, remainingStays);
  const existingDays = state.dayPlacesByGroupId[groupId] ?? [];

  const daysOutsideRange = existingDays.filter(
    (d) => d.date < locationClearStart || d.date > locationClearEnd,
  );
  const daysInsideRange = existingDays.filter(
    (d) => d.date >= locationClearStart && d.date <= locationClearEnd,
  );
  const repaintedOutside = staysWereModified
    ? applyStaysToDayPlaces(daysOutsideRange, remainingStays)
    : daysOutsideRange;
  const hasOverlappingNamedStays = scopedStays.some(
    (stay) =>
      stay.name?.trim() &&
      stay.checkInDate <= rangeEnd &&
      stay.checkOutDate > rangeStart,
  );
  let withGaps: DayPlaceDraft[];
  if (hasOverlappingNamedStays) {
    withGaps = paintRangeGaps(repaintedOutside, locationClearStart, locationClearEnd);
  } else if (isPersonalOverlayGroup(state, groupId)) {
    withGaps = clearPersonalOverlayLocationInSpan(state, groupId, halfSelection);
    if (staysWereModified) {
      withGaps = applyStaysToDayPlaces(withGaps, remainingStays);
    }
  } else {
    const cleared = clearAllLocationInSpan(
      [...repaintedOutside, ...daysInsideRange],
      halfSelection,
    );
    withGaps = staysWereModified
      ? applyStaysToDayPlaces(cleared, remainingStays)
      : cleared;
  }

  const blankedDates = new Set(
    enumerateDates(locationClearStart, locationClearEnd).filter((date) => {
      const day = withGaps.find((d) => d.date === date);
      return day && !day.primaryCity.trim() && !day.secondaryCity?.trim();
    }),
  );

  const stripped = withGaps.filter(
    (d) => d.primaryCity.trim() || d.secondaryCity?.trim() || blankedDates.has(d.date),
  );

  let next: TripSetupState = {
    ...state,
    accommodationStays: mergeAccommodationStays(state, groupId, remainingStays),
    dayPlacesByGroupId: {
      ...state.dayPlacesByGroupId,
      [groupId]: stripped.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim()),
    },
  };

  if (blankedDates.size) {
    next = removeIntercityLegsOnDates(next, blankedDates, groupId);
  }

  if (isMain) {
    next = syncTripBoundsFromContent(next);
  }

  return next;
}
