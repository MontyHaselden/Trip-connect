import { DateTime } from "luxon";

export type ChangeScopeMode = "today" | "whole_trip" | "dates";

export type ChangeScope = {
  mode: ChangeScopeMode;
  /** Set when mode is today */
  date?: string;
  /** Set when mode is dates */
  dates?: string[];
};

export function resolveDefaultTodayDate(
  timezone: string,
  startDate: string,
  endDate: string,
): string {
  const today = DateTime.now().setZone(timezone).toISODate();
  if (!today) return startDate;
  if (today >= startDate && today <= endDate) return today;
  if (today < startDate) return startDate;
  return endDate;
}

export function formatChangeScopePrompt(scope: ChangeScope): string {
  if (scope.mode === "today" && scope.date) {
    return `Apply changes to this day only: ${scope.date}.`;
  }
  if (scope.mode === "whole_trip") {
    return "Apply changes across the whole trip.";
  }
  if (scope.mode === "dates" && scope.dates?.length) {
    return `Apply changes only on these dates: ${scope.dates.join(", ")}.`;
  }
  return "";
}

export function primaryScopeDate(scope: ChangeScope): string | undefined {
  if (scope.mode === "today") return scope.date;
  if (scope.mode === "dates") return scope.dates?.[0];
  return undefined;
}

export function scopeSummaryLabel(scope: ChangeScope): string {
  if (scope.mode === "today" && scope.date) {
    return DateTime.fromISO(scope.date).toFormat("d MMM");
  }
  if (scope.mode === "whole_trip") return "Whole trip";
  if (scope.mode === "dates" && scope.dates?.length) {
    return scope.dates.length === 1
      ? DateTime.fromISO(scope.dates[0]!).toFormat("d MMM")
      : `${scope.dates.length} days`;
  }
  return "Today";
}
