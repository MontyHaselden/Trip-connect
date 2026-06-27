import { DEFAULT_HALF_SHARE } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import { isTravelSplitSlice, normalizeSlice } from "./slice-day";
import type { CalendarDaySlice } from "./types";

/** Convert legacy DayPlaceDraft (primary/secondary/share) to explicit AM/PM slice. */
export function dayPlaceToSlice(day: DayPlaceDraft): CalendarDaySlice {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (primary && secondary) {
    return normalizeSlice({
      date: day.date,
      amCity: primary,
      pmCity: secondary,
      dayType: day.dayType,
    });
  }
  if (primary && share < 0.99) {
    return normalizeSlice({
      date: day.date,
      amCity: primary,
      pmCity: "",
      dayType: day.dayType,
    });
  }
  if (!primary && secondary) {
    return normalizeSlice({
      date: day.date,
      amCity: "",
      pmCity: secondary,
      dayType: day.dayType,
    });
  }
  if (primary) {
    return normalizeSlice({
      date: day.date,
      amCity: primary,
      pmCity: primary,
      dayType: day.dayType,
    });
  }
  return { date: day.date, amCity: "", pmCity: "", dayType: day.dayType };
}

/** Convert explicit AM/PM slice to legacy DayPlaceDraft for UI rendering. */
export function sliceToDayPlace(slice: CalendarDaySlice): DayPlaceDraft {
  const am = slice.amCity.trim();
  const pm = slice.pmCity.trim();

  if (am && pm && am === pm) {
    return {
      date: slice.date,
      primaryCity: am,
      secondaryCity: null,
      primaryShare: 1,
      dayType: slice.dayType,
      includeBuffer: false,
    };
  }
  if (am && pm) {
    return {
      date: slice.date,
      primaryCity: am,
      secondaryCity: pm,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: slice.dayType,
      includeBuffer: false,
    };
  }
  if (am && !pm) {
    return {
      date: slice.date,
      primaryCity: am,
      secondaryCity: null,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: slice.dayType,
      includeBuffer: false,
    };
  }
  if (!am && pm) {
    return {
      date: slice.date,
      primaryCity: "",
      secondaryCity: pm,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: slice.dayType,
      includeBuffer: false,
    };
  }
  return {
    date: slice.date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: slice.dayType,
    includeBuffer: false,
  };
}

export function slicesToDayPlaces(slices: CalendarDaySlice[]): DayPlaceDraft[] {
  return slices.map(sliceToDayPlace);
}

export function dayPlacesToSlices(days: DayPlaceDraft[]): CalendarDaySlice[] {
  return days.map(dayPlaceToSlice);
}

export function isCitySplitDay(day: DayPlaceDraft): boolean {
  return isTravelSplitSlice(dayPlaceToSlice(day));
}
