import type { HalfSide } from "@/lib/host/wizard/location-stays";

export type CalendarRangeSelection = {
  rangeStart: string;
  rangeEnd: string;
  startHalf: HalfSide | "full";
  endHalf: HalfSide | "full";
};

export const EMPTY_CALENDAR_SELECTION: CalendarRangeSelection = {
  rangeStart: "",
  rangeEnd: "",
  startHalf: "full",
  endHalf: "full",
};

/** Forward-only range building: anchor day, then extend end; click inside range re-anchors. */
export function nextCalendarRangeSelection(
  current: CalendarRangeSelection,
  clickedIso: string,
): { selection: CalendarRangeSelection; selected: boolean } {
  const { rangeStart, rangeEnd } = current;
  const end = rangeEnd || rangeStart;

  if (rangeStart && clickedIso >= rangeStart && clickedIso <= end) {
    if (rangeStart === end) {
      return { selection: EMPTY_CALENDAR_SELECTION, selected: false };
    }
    return {
      selection: {
        rangeStart: clickedIso,
        rangeEnd: clickedIso,
        startHalf: "full",
        endHalf: "full",
      },
      selected: true,
    };
  }

  if (!rangeStart) {
    return {
      selection: {
        rangeStart: clickedIso,
        rangeEnd: clickedIso,
        startHalf: "full",
        endHalf: "full",
      },
      selected: true,
    };
  }

  const newStart = clickedIso < rangeStart ? clickedIso : rangeStart;
  const newEnd = clickedIso > end ? clickedIso : end;
  return {
    selection: {
      rangeStart: newStart,
      rangeEnd: newEnd,
      startHalf: "full",
      endHalf: "full",
    },
    selected: true,
  };
}
