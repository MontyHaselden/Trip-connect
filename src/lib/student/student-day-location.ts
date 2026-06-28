import { locationsMatch } from "@/lib/host/wizard/location-stays";

const PLACEHOLDER_CITIES = new Set(["tbc", "unknown", ""]);

/** Hotel nights: check-in date through the night before check-out. */
export function stayCoversNightOnDate(
  checkInDate: string,
  checkOutDate: string,
  dateISO: string,
): boolean {
  return checkInDate <= dateISO && checkOutDate > dateISO;
}

/** Assignment spans are inclusive on both ends. */
export function assignmentCoversDate(
  startDate: string,
  endDate: string,
  dateISO: string,
): boolean {
  return startDate <= dateISO && endDate >= dateISO;
}

export function isPlaceholderCityLabel(city: string | null | undefined): boolean {
  return PLACEHOLDER_CITIES.has((city ?? "").trim().toLowerCase());
}

export function studentDayLocationLabel(day: {
  cityLabel: string;
  calendarLabel?: string | null;
  dayType?: string | null;
  secondaryCityLabel?: string | null;
}): string {
  if (day.dayType === "travel" && day.secondaryCityLabel?.trim()) {
    const from = day.cityLabel.trim();
    const to = day.secondaryCityLabel.trim();
    if (!isPlaceholderCityLabel(from) && !isPlaceholderCityLabel(to)) {
      return `${from} → ${to}`;
    }
  }

  const calendar = day.calendarLabel?.trim() ?? "";
  if (calendar && !isPlaceholderCityLabel(calendar)) return calendar;

  const city = day.cityLabel.trim();
  if (city && !isPlaceholderCityLabel(city)) return city;

  return calendar || city;
}

export function formatStudentInCityLabel(locationLabel: string): string | null {
  const label = locationLabel.trim();
  if (!label || isPlaceholderCityLabel(label)) return null;
  if (label.includes("→")) return label;
  return `In ${label}`;
}

export function stayMatchesDayCity(
  stayCityLabel: string | null | undefined,
  dayCityLabel: string | null | undefined,
): boolean {
  const stayCity = stayCityLabel?.trim() ?? "";
  const dayCity = dayCityLabel?.trim() ?? "";
  if (!stayCity || !dayCity || isPlaceholderCityLabel(stayCity) || isPlaceholderCityLabel(dayCity)) {
    return false;
  }
  return locationsMatch(stayCity, dayCity);
}
