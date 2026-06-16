import { DEFAULT_HALF_SHARE, type HalfSide } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function paintHalf(day: DayPlaceDraft, location: string, half: HalfSide): DayPlaceDraft {
  const loc = location.trim();
  if (half === "right") {
    return {
      ...day,
      secondaryCity: loc,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "travel",
    };
  }
  return {
    ...day,
    primaryCity: loc,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: day.dayType === "buffer" ? "buffer" : "travel",
  };
}

/** Apply half-day constraints after a full-range location paint. */
export function applyHalfDayPaint(
  days: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
  location: string,
  startHalf: HalfSide | "full",
  endHalf: HalfSide | "full",
): DayPlaceDraft[] {
  if (startHalf === "full" && endHalf === "full") return days;
  const end = rangeEnd || rangeStart;

  return days.map((day) => {
    if (day.date < rangeStart || day.date > end) return day;

    if (rangeStart === end) {
      if (startHalf === "left") return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
      if (startHalf === "right") return paintHalf({ ...day, primaryCity: "", primaryShare: 1 }, location, "right");
      if (startHalf === "full" && endHalf === "left") {
        return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
      }
      if (startHalf === "full" && endHalf === "right") {
        return paintHalf({ ...day, primaryCity: "", primaryShare: 1 }, location, "right");
      }
      return day;
    }

    if (day.date === rangeStart && startHalf === "right") {
      return paintHalf({ ...day, primaryCity: day.primaryCity, secondaryCity: null, primaryShare: 1 }, location, "right");
    }
    if (day.date === end && endHalf === "left") {
      return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
    }
    if (day.date === rangeStart && startHalf === "left") {
      return paintHalf({ ...day, secondaryCity: null, primaryShare: 1 }, location, "left");
    }
    if (day.date === end && endHalf === "right") {
      return paintHalf({ ...day, primaryCity: day.primaryCity, secondaryCity: null, primaryShare: 1 }, location, "right");
    }
    return day;
  });
}
