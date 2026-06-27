import type { CalendarDaySlice } from "./types";

export type CalendarInvariantViolation = {
  date: string;
  message: string;
};

/** Assert no day has ambiguous or invalid half combinations. */
export function assertSliceInvariants(
  slices: CalendarDaySlice[],
): CalendarInvariantViolation[] {
  const violations: CalendarInvariantViolation[] = [];

  for (const slice of slices) {
    const am = slice.amCity.trim();
    const pm = slice.pmCity.trim();

    if (am && pm && am === pm && slice.dayType === "travel") {
      violations.push({
        date: slice.date,
        message: "Travel dayType on a single-city full day",
      });
    }
  }

  return violations;
}

export function assertMonotonicRange(
  rangeStart: string,
  rangeEnd: string,
): void {
  const end = rangeEnd || rangeStart;
  if (rangeStart > end) {
    throw new Error(`Invalid calendar range: ${rangeStart} > ${end}`);
  }
}
