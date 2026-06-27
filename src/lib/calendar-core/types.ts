import type { DayType } from "@/lib/host/wizard/types";

/** Explicit morning/evening location halves — canonical storage model. */
export type CalendarDaySlice = {
  date: string;
  amCity: string;
  pmCity: string;
  dayType: DayType;
};

export type CalendarHalf = "am" | "pm";

export type HalfSelection = CalendarHalf | "full";

export type GroupCalendarMode = "inherit" | "override";

/** Sparse per-date overrides for personal/subgroup calendars. */
export type SliceOverride = {
  date: string;
  amCity?: string;
  pmCity?: string;
  dayType?: DayType;
};

export type PaintRangeOptions = {
  /** Adjacent-day context when painting personal groups against main calendar. */
  transitionContextSlices?: CalendarDaySlice[];
};
