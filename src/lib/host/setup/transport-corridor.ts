import {
  arrivalAccommodationLabel,
  departureAccommodationLabel,
} from "@/lib/host/setup/accommodation-calendar";
import { isLocationCrossover, type TripPlaceContext } from "@/lib/host/setup/home-locks";
import { addDays } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

/** Transfer day: half departure city · half arrival city (travel label in overlay). */
export const TRANSPORT_CORRIDOR_LEFT_SHARE = 0.5;
export const TRANSPORT_CORRIDOR_WIDTH = 0;
export const TRANSPORT_CORRIDOR_RIGHT_START = 0.5;

/** Wider band for multi-leg / same-day travel stacks on departure days. */
export const TRANSPORT_STACK_WIDTH = 0.5;
export const TRANSPORT_STACK_LEFT_SHARE = 0.25;
export const TRANSPORT_STACK_RIGHT_START = 0.75;

/** Travel day: half origin · half destination (transit label in overlay). */
export const MAJOR_TRAVEL_ORIGIN_END = 0.5;
export const MAJOR_TRAVEL_TRANSIT_START = 0.5;
export const MAJOR_TRAVEL_TRANSIT_END = 0.5;
export const MAJOR_TRAVEL_DEST_START = 0.5;
export const MAJOR_TRAVEL_DEST_SLICE = 0.5;
export const MAJOR_TRAVEL_ORIGIN_MIN = 0.5;

/** @deprecated Use TRANSPORT_CORRIDOR_LEFT_SHARE */
export const TRANSPORT_CORRIDOR_SHARE = TRANSPORT_CORRIDOR_LEFT_SHARE;

export function isAccommodationCrossoverDay(
  day: DayPlaceDraft,
  accoByDate: Map<string, string>,
  trip: TripPlaceContext,
  stays?: AccommodationStayDraft[],
): boolean {
  if (!isLocationCrossover(day, trip)) return false;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary || !secondary) return false;

  if (stays?.length) {
    return (
      Boolean(departureAccommodationLabel(day.date, primary, stays)) &&
      Boolean(arrivalAccommodationLabel(day.date, secondary, stays))
    );
  }

  const hasDepartureAcco =
    accoByDate.has(day.date) || accoByDate.has(addDays(day.date, -1));
  const hasArrivalAcco = accoByDate.has(day.date);

  return hasDepartureAcco && hasArrivalAcco;
}

/** Short city label for transfer planning (e.g. Christchurch → CHC). */
export function transferCityCode(city: string): string {
  const label = city.split(",")[0]?.trim() || city.trim();
  if (!label) return "—";
  if (label.length <= 4) return label.toUpperCase();
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    return (initials + label.slice(0, 3).toUpperCase()).slice(0, 3);
  }
  return label.slice(0, 3).toUpperCase();
}
