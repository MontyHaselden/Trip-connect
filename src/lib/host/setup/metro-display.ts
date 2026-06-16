import { isAirportPlace, metroKeyForPlace } from "@/lib/geo/airport-codes";

/** Human metro label from an airport or city string. */
export function metroDisplayLabel(place: string): string {
  const trimmed = place.trim();
  if (!trimmed) return "";

  if (!isAirportPlace(trimmed)) {
    return trimmed.split(",")[0]?.trim() || trimmed;
  }

  const key = metroKeyForPlace(trimmed);
  if (!key) return trimmed.split(",")[0]?.trim() || trimmed;

  return key
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
