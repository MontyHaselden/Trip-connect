import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { addDays, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

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

function dayHasCity(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

function cityOnDay(day: DayPlaceDraft, city: string): boolean {
  const loc = city.trim().toLowerCase();
  return (
    day.primaryCity.trim().toLowerCase() === loc ||
    (day.secondaryCity?.trim().toLowerCase() ?? "") === loc
  );
}

/**
 * Ensure every interior calendar day of a named stay is painted full-city.
 * Fills blank days sandwiched between the same location (e.g. Kyoto Dec 16 between edge halves).
 */
export function fillAccommodationInteriorGaps(
  dayPlaces: DayPlaceDraft[],
  stays: AccommodationStayDraft[],
): DayPlaceDraft[] {
  const byDate = new Map(dayPlaces.map((d) => [d.date, d]));

  for (const stay of stays) {
    if (!stay.name?.trim()) continue;
    const city = stayCityLabel(stay);
    if (!city) continue;

    const lastNight = addDays(stay.checkOutDate, -1);
    if (stay.checkInDate > lastNight) continue;

    let cursor = stay.checkInDate;
    while (cursor <= stay.checkOutDate) {
      if (!byDate.has(cursor)) byDate.set(cursor, emptyDay(cursor));
      cursor = addDays(cursor, 1);
    }

    let interior = addDays(stay.checkInDate, 1);
    while (interior <= lastNight) {
      const day = byDate.get(interior)!;
      const primary = day.primaryCity.trim();
      const secondary = day.secondaryCity?.trim() ?? "";

      if (primary && secondary && !locationsMatch(primary, secondary)) {
        interior = addDays(interior, 1);
        continue;
      }

      if (!cityOnDay(day, city) || (day.primaryShare ?? 1) < 0.99) {
        byDate.set(interior, {
          ...day,
          primaryCity: city,
          secondaryCity: null,
          primaryShare: 1,
          dayType: day.dayType === "buffer" ? "buffer" : "trip",
        });
      }
      interior = addDays(interior, 1);
    }
  }

  return [...byDate.values()]
    .filter((d) => dayHasCity(d))
    .sort((a, b) => a.date.localeCompare(b.date));
}
