import { placesShareMetro } from "@/lib/geo/airport-codes";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import {
  allPlaneLegsFromState,
  metroDisplayLabel,
} from "@/lib/host/setup/infer-flight-calendar";
import type { TripSetupState } from "@/lib/host/setup/types";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

/** Earliest plane arrival at a stay city — you cannot check in before this. */
function earliestPlaneArrivalAtCity(
  state: Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">,
  city: string,
): string | null {
  let earliest: string | null = null;

  for (const leg of allPlaneLegsFromState(state)) {
    const dest = metroDisplayLabel(leg.toCity);
    if (!dest || !placesShareMetro(dest, city)) continue;
    const arr = arrivalDate(leg);
    if (!arr) continue;
    if (!earliest || arr < earliest) earliest = arr;
  }

  return earliest;
}

/**
 * Push named stay check-in to the first flight arrival at that city.
 * Clears impossible "at the hotel before the plane lands" windows.
 */
export function syncStaysToDestinationArrivals(
  stays: AccommodationStayDraft[],
  state: Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">,
): AccommodationStayDraft[] {
  let changed = false;

  const next = stays.map((stay) => {
    if (!stay.name?.trim()) return stay;

    const city = stayCityLabel(stay);
    if (!city) return stay;

    const earliestArrival = earliestPlaneArrivalAtCity(state, city);
    if (!earliestArrival || stay.checkInDate >= earliestArrival) return stay;
    if (earliestArrival >= stay.checkOutDate) return stay;

    changed = true;
    return { ...stay, checkInDate: earliestArrival };
  });

  return changed ? next : stays;
}

export function syncMainStaysToDestinationArrivals(state: TripSetupState): TripSetupState {
  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
  if (!named.length) return state;

  const synced = syncStaysToDestinationArrivals(state.accommodationStays, state);
  if (synced === state.accommodationStays) return state;

  return { ...state, accommodationStays: synced };
}
