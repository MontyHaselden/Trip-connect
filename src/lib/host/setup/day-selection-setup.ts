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
      named.find((s) => s.checkInDate <= date && s.checkOutDate >= date) ??
      named.find((s) => s.checkOutDate === date) ??
      null
    );
  }
  if (half === "left") {
    return (
      named.find((s) => s.checkOutDate === date) ??
      named.find((s) => stayCoversNight(s, date)) ??
      null
    );
  }
  return named.find((s) => s.checkInDate === date && s.checkOutDate > date) ?? null;
}

/** Check-in/out when saving accommodation — does not expand the calendar selection. */
export function stayDatesForSelection(
  selection: NightPairSelection,
  existing?: { checkIn: string; checkOut: string } | null,
): { checkIn: string; checkOut: string } {
  const end = selection.rangeEnd || selection.rangeStart;
  const half =
    selection.rangeStart === end &&
    selection.startHalf === selection.endHalf &&
    selection.startHalf !== "full"
      ? selection.startHalf
      : "full";

  if (half === "right") {
    const base = { checkIn: selection.rangeStart, checkOut: addDays(selection.rangeStart, 1) };
    if (!existing) return base;
    return {
      checkIn: existing.checkIn < base.checkIn ? existing.checkIn : base.checkIn,
      checkOut: existing.checkOut > base.checkOut ? existing.checkOut : base.checkOut,
    };
  }
  if (half === "left") {
    const base = { checkIn: addDays(selection.rangeStart, -1), checkOut: selection.rangeStart };
    if (!existing) return base;
    return {
      checkIn: existing.checkIn < base.checkIn ? existing.checkIn : base.checkIn,
      checkOut: existing.checkOut > base.checkOut ? existing.checkOut : base.checkOut,
    };
  }

  const selectionCheckout = addDays(end, 1);
  if (!existing) {
    return { checkIn: selection.rangeStart, checkOut: selectionCheckout };
  }
  return {
    checkIn: existing.checkIn < selection.rangeStart ? existing.checkIn : selection.rangeStart,
    checkOut:
      existing.checkOut > selectionCheckout ? existing.checkOut : selectionCheckout,
  };
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
