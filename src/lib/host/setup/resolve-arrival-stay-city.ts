import { placesShareMetro } from "@/lib/geo/airport-codes";
import {
  effectiveHotelBandStart,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import { addDays } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, TransportLegDraft } from "@/lib/host/wizard/types";

/** Named stays with a hotel/property name. */
export function namedStays(stays: AccommodationStayDraft[]): AccommodationStayDraft[] {
  return stays.filter((stay) => stay.name?.trim());
}

/**
 * When leaving from an airport metro, prefer the trip's named stay city
 * in that metro (e.g. HKT → Patong when Royal Paradise checks out that morning).
 */
export function resolveDepartureStayCity(
  departurePlace: string,
  stays: AccommodationStayDraft[],
  travelDate: string,
): string {
  const metro = metroDisplayLabel(departurePlace);
  if (!metro.trim()) return departurePlace.trim();

  const candidates = namedStays(stays).filter((stay) => {
    const city = stayCityLabel(stay);
    if (!city || !placesShareMetro(city, metro)) return false;
    return (
      stay.checkOutDate === travelDate ||
      (stay.checkInDate <= travelDate && stay.checkOutDate > travelDate)
    );
  });

  if (!candidates.length) return metro;

  const checkout = candidates.find((stay) => stay.checkOutDate === travelDate);
  if (checkout) return stayCityLabel(checkout) || metro;

  return stayCityLabel(candidates[0]!) || metro;
}

/**
 * When a flight lands at an airport metro, prefer the trip's named stay city
 * in that metro (e.g. HKT → Patong when Royal Paradise is booked in Patong).
 */
export function resolveArrivalStayCity(
  arrivalPlace: string,
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[],
  arrivalOn: string,
): string {
  const metro = metroDisplayLabel(arrivalPlace);
  if (!metro.trim()) return arrivalPlace.trim();

  const candidates = namedStays(stays).filter((stay) => {
    const city = stayCityLabel(stay);
    return city && placesShareMetro(city, metro);
  });

  if (!candidates.length) return metro;

  const nextDay = addDays(arrivalOn, 1);

  const scored = candidates.map((stay) => {
    const bandStart = effectiveHotelBandStart(stay, planeLegs);
    let score = 0;
    if (bandStart === arrivalOn) score += 2;
    if (bandStart === nextDay) score += 3;
    if (stay.checkInDate === arrivalOn || stay.checkInDate === nextDay) score += 1;
    return { stay, score, bandStart };
  });

  scored.sort((a, b) => b.score - a.score || a.bandStart.localeCompare(b.bandStart));
  const best = scored[0];
  if (!best || best.score === 0) {
    return stayCityLabel(candidates[0]!) || metro;
  }

  return stayCityLabel(best.stay) || metro;
}
