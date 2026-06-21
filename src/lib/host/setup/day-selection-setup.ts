import {
  expandSelectionToNightPair,
  type NightPairSelection,
} from "@/lib/host/setup/night-pair-selection";
import {
  addDays,
  cityOnHalf,
  enumerateDates,
  getEmptyHalf,
  isHalfEmpty,
  locationsMatch,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

export function dayCoveredByNamedStay(stays: AccommodationStayDraft[], date: string): boolean {
  return stays.some(
    (s) => s.name?.trim() && s.checkInDate <= date && s.checkOutDate > date,
  );
}

export function stayCoversNight(stay: AccommodationStayDraft, date: string): boolean {
  return Boolean(stay.name?.trim() && stay.checkInDate <= date && stay.checkOutDate > date);
}

/** Which half of `date` is included in this selection. */
export function halfForDateInSelection(
  selection: NightPairSelection,
  date: string,
): HalfSide | "full" {
  const end = selection.rangeEnd || selection.rangeStart;
  if (selection.rangeStart === end) {
    return selection.startHalf === "full" ? "full" : selection.startHalf;
  }
  if (date === selection.rangeStart) return selection.startHalf;
  if (date === end) return selection.endHalf;
  return "full";
}

/** True when a named stay touches any selected half-day slice — not merely checkout on an unselected morning. */
export function stayOverlapsSelection(
  stay: AccommodationStayDraft,
  selection: NightPairSelection,
): boolean {
  if (!stay.name?.trim()) return false;
  const end = selection.rangeEnd || selection.rangeStart;
  for (const iso of enumerateDates(selection.rangeStart, end)) {
    const half = halfForDateInSelection(selection, iso);
    const linked = stayForHalfSelection([stay], iso, half);
    if (linked?.id === stay.id) return true;
  }
  return false;
}

/** First stay that overlaps any selected half-day slice. */
export function stayLinkedToHalfAwareSelection(
  stays: AccommodationStayDraft[],
  selection: NightPairSelection,
): AccommodationStayDraft | null {
  for (const stay of stays) {
    if (stayOverlapsSelection(stay, selection)) return stay;
  }
  return null;
}

/** Location label for one selected slice of a day. */
export function locationLabelForSelectedHalf(
  day: DayPlaceDraft,
  half: HalfSide | "full",
): string {
  if (half === "full") {
    const parts: string[] = [];
    if (day.primaryCity.trim()) parts.push(day.primaryCity.trim());
    if (day.secondaryCity?.trim()) parts.push(day.secondaryCity.trim());
    return parts.join(" · ") || "";
  }
  return cityOnHalf(day, half).trim();
}

/** Stay belongs to this selection — not merely a checkout edge from an earlier block. */
export function stayRelevantToSelection(
  stay: AccommodationStayDraft,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (!stay.name?.trim()) return false;
  const end = rangeEnd || rangeStart;
  if (stay.checkInDate >= rangeStart && stay.checkInDate <= end) return true;
  if (stay.checkInDate <= rangeStart && stay.checkOutDate > end) return true;
  if (
    rangeStart === end &&
    stay.checkOutDate === rangeStart &&
    stay.checkInDate < rangeStart
  ) {
    return true;
  }
  return false;
}

/** Stay linked to a single half — not checkout morning when the evening half is selected. */
export function stayForHalfSelection(
  stays: AccommodationStayDraft[],
  date: string,
  half: HalfSide | "full",
): AccommodationStayDraft | null {
  const named = stays.filter((s) => s.name?.trim());
  if (half === "full") {
    return (
      named.find((s) => s.checkInDate <= date && s.checkOutDate > date) ??
      named.find((s) => s.checkOutDate === date) ??
      null
    );
  }
  if (half === "left") {
    return (
      named.find((s) => s.checkOutDate === date) ??
      named.find((s) => s.checkInDate < date && stayCoversNight(s, date)) ??
      null
    );
  }
  return named.find((s) => s.checkInDate === date && s.checkOutDate > date) ?? null;
}

/** Half-aware check-in/out bounds for a calendar selection (exclusive checkout date). */
export function stayDateBoundsForSelection(selection: NightPairSelection): {
  checkIn: string;
  checkOut: string;
} {
  const end = selection.rangeEnd || selection.rangeStart;
  const singleDay = selection.rangeStart === end;

  if (singleDay) {
    const half =
      selection.startHalf === selection.endHalf && selection.startHalf !== "full"
        ? selection.startHalf
        : "full";
    if (half === "right") {
      return { checkIn: selection.rangeStart, checkOut: addDays(selection.rangeStart, 1) };
    }
    if (half === "left") {
      return { checkIn: addDays(selection.rangeStart, -1), checkOut: selection.rangeStart };
    }
    return { checkIn: selection.rangeStart, checkOut: addDays(selection.rangeStart, 1) };
  }

  let checkIn = selection.rangeStart;
  if (selection.startHalf === "left") {
    checkIn = addDays(selection.rangeStart, -1);
  }

  const checkOut = selection.endHalf === "right" ? addDays(end, 1) : end;
  return { checkIn, checkOut };
}

function clampStayDatesToBounds(
  bounds: { checkIn: string; checkOut: string },
  existing?: { checkIn: string; checkOut: string } | null,
): { checkIn: string; checkOut: string } {
  if (!existing) return bounds;

  let checkIn = existing.checkIn;
  if (checkIn < bounds.checkIn) checkIn = bounds.checkIn;
  if (checkIn >= bounds.checkOut) checkIn = bounds.checkIn;

  let checkOut = existing.checkOut;
  if (checkOut > bounds.checkOut) checkOut = bounds.checkOut;
  if (checkOut <= checkIn) checkOut = bounds.checkOut;

  return { checkIn, checkOut };
}

/** Check-in/out when saving accommodation — clamped to selection, never past half-day bounds. */
export function stayDatesForSelection(
  selection: NightPairSelection,
  existing?: { checkIn: string; checkOut: string } | null,
): { checkIn: string; checkOut: string } {
  return clampStayDatesToBounds(stayDateBoundsForSelection(selection), existing);
}

/** Full selection span when applying a stay across multiple calendar days. */
export function stayDatesForRangeApply(
  selection: NightPairSelection,
): { checkIn: string; checkOut: string } {
  return stayDateBoundsForSelection(selection);
}

/** Check-in/out for expanded night-pair selections (e.g. setup board removal). */
export function stayDatesForExpandedSelection(
  selection: NightPairSelection,
  existing?: { checkIn: string; checkOut: string } | null,
): { checkIn: string; checkOut: string } {
  const expanded = expandSelectionToNightPair(selection);
  const end = expanded.rangeEnd || expanded.rangeStart;
  const nightPair =
    expanded.startHalf === "right" &&
    expanded.endHalf === "left" &&
    addDays(expanded.rangeStart, 1) === end;

  if (nightPair) {
    const base = { checkIn: expanded.rangeStart, checkOut: end };
    if (!existing) return base;
    return {
      checkIn: existing.checkIn < base.checkIn ? existing.checkIn : base.checkIn,
      checkOut: existing.checkOut > base.checkOut ? existing.checkOut : base.checkOut,
    };
  }

  return stayDatesForSelection(expanded, existing);
}

export function staySelectionSpan(
  stay: AccommodationStayDraft,
  rangeStart: string,
  rangeEnd: string,
): { from: string; to: string } | null {
  const end = rangeEnd || rangeStart;
  let from: string | null = null;
  let to: string | null = null;
  for (const iso of enumerateDates(rangeStart, end)) {
    if (!stayCoversNight(stay, iso)) continue;
    if (!from) from = iso;
    to = iso;
  }
  if (!from || !to) return null;
  return { from, to };
}

export function selectionNeedsSetup(
  rangeStart: string,
  end: string,
  selectedHalf: HalfSide | "full",
  daysInRange: DayPlaceDraft[],
  namedStays: AccommodationStayDraft[],
): { needsLocation: boolean; needsAccommodation: boolean } {
  if (rangeStart === end && selectedHalf !== "full") {
    const day = daysInRange.find((d) => d.date === rangeStart);
    const halfEmpty = Boolean(day && isHalfEmpty(day, selectedHalf));
    const locOnHalf = day ? cityOnHalf(day, selectedHalf).trim() : "";
    return {
      needsLocation: halfEmpty || !locOnHalf,
      needsAccommodation: halfEmpty || !dayCoveredByNamedStay(namedStays, rangeStart),
    };
  }

  let needsLocation = false;
  let needsAccommodation = false;
  for (const iso of enumerateDates(rangeStart, end)) {
    const day = daysInRange.find((d) => d.date === iso);
    const primary = day?.primaryCity.trim() ?? "";
    const secondary = day?.secondaryCity?.trim() ?? "";
    const emptyHalf = day ? getEmptyHalf(day) : null;

    if (!primary && !secondary) needsLocation = true;
    if (emptyHalf) needsLocation = true;

    if (!dayCoveredByNamedStay(namedStays, iso)) needsAccommodation = true;
    if (emptyHalf) needsAccommodation = true;
  }
  return { needsLocation, needsAccommodation };
}

export type AccommodationLocationConflict = {
  rangeStart: string;
  rangeEnd: string;
  existingLocation: string;
  existingAccommodation?: string | null;
};

function emptyDayPlace(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function coalesceLabeledDateRanges(
  entries: {
    date: string;
    location: string;
    accommodation: string | null;
  }[],
): AccommodationLocationConflict[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out: AccommodationLocationConflict[] = [];
  let run: {
    start: string;
    end: string;
    location: string;
    accommodation: string | null;
  } | null = null;

  for (const { date, location, accommodation } of sorted) {
    const sameRun =
      run &&
      run.location === location &&
      run.accommodation === accommodation &&
      addDays(run.end, 1) === date;
    if (sameRun) {
      run!.end = date;
      continue;
    }
    if (run) {
      out.push({
        rangeStart: run.start,
        rangeEnd: run.end,
        existingLocation: run.location,
        existingAccommodation: run.accommodation,
      });
    }
    run = { start: date, end: date, location, accommodation };
  }

  if (run) {
    out.push({
      rangeStart: run.start,
      rangeEnd: run.end,
      existingLocation: run.location,
      existingAccommodation: run.accommodation,
    });
  }
  return out;
}

/** Days in a selection whose painted location differs from the accommodation city. */
export function detectAccommodationLocationConflicts(
  selection: NightPairSelection,
  days: DayPlaceDraft[],
  accommodationCity: string,
  stays: AccommodationStayDraft[] = [],
): AccommodationLocationConflict[] {
  const city = accommodationCity.trim();
  if (!city) return [];

  const end = selection.rangeEnd || selection.rangeStart;
  const labeledDates: {
    date: string;
    location: string;
    accommodation: string | null;
  }[] = [];

  for (const iso of enumerateDates(selection.rangeStart, end)) {
    const day = days.find((d) => d.date === iso) ?? emptyDayPlace(iso);
    const half = halfForDateInSelection(selection, iso);
    const existing = locationLabelForSelectedHalf(day, half).trim();
    if (!existing) continue;
    if (locationsMatch(existing, city)) continue;
    const existingStay = stays.length ? stayForHalfSelection(stays, iso, half) : null;
    labeledDates.push({
      date: iso,
      location: existing,
      accommodation: existingStay?.name?.trim() || null,
    });
  }

  return coalesceLabeledDateRanges(labeledDates);
}

function normalizeCityToken(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  return trimmed.split(",")[0]?.trim() || trimmed;
}

function bumpCityCount(counts: Map<string, number>, label: string) {
  const city = normalizeCityToken(label);
  if (!city || city.toLowerCase() === "tbc") return;
  counts.set(city, (counts.get(city) ?? 0) + 1);
}

/** City for hotel search — uses selected calendar halves, not whole-day primaries on travel edges. */
export function accommodationCityForSelection(
  selection: NightPairSelection,
  days: DayPlaceDraft[],
): string {
  const end = selection.rangeEnd || selection.rangeStart;
  const bounds = stayDateBoundsForSelection(selection);
  const nightCounts = new Map<string, number>();

  for (const iso of enumerateDates(bounds.checkIn, addDays(bounds.checkOut, -1))) {
    const day = days.find((d) => d.date === iso) ?? emptyDayPlace(iso);
    const inSelectedRange = iso >= selection.rangeStart && iso <= end;
    const half = inSelectedRange ? halfForDateInSelection(selection, iso) : "full";

    if (half === "left" || half === "right") {
      bumpCityCount(nightCounts, cityOnHalf(day, half));
      continue;
    }

    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    if (primary && !secondary) {
      bumpCityCount(nightCounts, primary);
    } else if (!primary && secondary) {
      bumpCityCount(nightCounts, secondary);
    } else if (secondary) {
      bumpCityCount(nightCounts, secondary);
    } else if (primary) {
      bumpCityCount(nightCounts, primary);
    }
  }

  if (!nightCounts.size) {
    for (const iso of enumerateDates(selection.rangeStart, end)) {
      const day = days.find((d) => d.date === iso) ?? emptyDayPlace(iso);
      const half = halfForDateInSelection(selection, iso);
      if (half === "left" || half === "right") {
        bumpCityCount(nightCounts, cityOnHalf(day, half));
        continue;
      }
      const primary = day.primaryCity.trim();
      const secondary = day.secondaryCity?.trim() ?? "";
      if (primary) bumpCityCount(nightCounts, primary);
      if (secondary) bumpCityCount(nightCounts, secondary);
    }
  }

  let best = "";
  let bestScore = 0;
  for (const [city, score] of nightCounts) {
    if (score > bestScore) {
      best = city;
      bestScore = score;
    }
  }
  return best;
}

export function accommodationLocationConflictMessage(
  accommodationCity: string,
  conflicts: AccommodationLocationConflict[],
  formatRange: (start: string, end: string) => string,
): string {
  const lines = conflicts.map((c) => {
    const stay =
      c.existingAccommodation?.trim() ? ` · ${c.existingAccommodation.trim()}` : "";
    return `• ${formatRange(c.rangeStart, c.rangeEnd)}: ${c.existingLocation}${stay}`;
  });
  return [
    `The stay city is "${accommodationCity.trim()}", but these days already have different locations:`,
    "",
    ...lines,
    "",
    "Applying will replace location labels on the selected days with the stay city.",
  ].join("\n");
}
