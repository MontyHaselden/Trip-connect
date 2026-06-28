import type { DayPlaceDraft } from "@/lib/host/wizard/types";

const PLACEHOLDER_CITIES = new Set(["tbc", "unknown", ""]);

export function isPlaceholderCityLabel(city: string | null | undefined): boolean {
  return PLACEHOLDER_CITIES.has((city ?? "").trim().toLowerCase());
}

/** Drop placeholder-only paint so calendar and overview stay in sync. */
export function clearPlaceholderCitiesFromDay(day: DayPlaceDraft): DayPlaceDraft {
  let primary = day.primaryCity.trim();
  let secondary = day.secondaryCity?.trim() ?? "";
  if (isPlaceholderCityLabel(primary)) primary = "";
  if (isPlaceholderCityLabel(secondary)) secondary = "";

  if (!primary && !secondary) {
    return {
      ...day,
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  return {
    ...day,
    primaryCity: primary,
    secondaryCity: secondary || null,
    primaryShare: secondary ? day.primaryShare : 1,
    dayType: !secondary && day.dayType === "travel" ? "trip" : day.dayType,
  };
}

export function stripPlaceholderDayPlaces(days: DayPlaceDraft[]): DayPlaceDraft[] {
  return days
    .map(clearPlaceholderCitiesFromDay)
    .filter((day) => day.primaryCity.trim() || day.secondaryCity?.trim());
}

export function dayHasMeaningfulLocationPaint(day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity">): boolean {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (isPlaceholderCityLabel(primary) && !secondary) return false;
  if (isPlaceholderCityLabel(secondary) && !primary) return false;
  return Boolean(primary || secondary);
}
