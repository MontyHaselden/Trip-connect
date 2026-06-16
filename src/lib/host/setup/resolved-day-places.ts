import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { mainAccommodationStays, mainIntercityLegs } from "@/lib/host/setup/entity-scope";
import { contentTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

/** Day places as shown on the setup calendar (derived from named stays + transport). */
export function resolvedMainDayPlaces(state: TripSetupState): DayPlaceDraft[] {
  const stored = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
  if (!named.length) return stored;

  const contentBounds = contentTripBoundsFromState(state);
  const gridStart = contentBounds?.startDate ?? named[0]!.checkInDate;
  const gridEnd = contentBounds?.endDate ?? named[0]!.checkOutDate;

  const trip = {
    startDate: gridStart,
    endDate: gridEnd,
    departureCity: state.basics.departureCity,
    returnCity: state.basics.returnCity,
  };

  return deriveCalendarState({
    stays: named,
    intercityLegs: mainIntercityLegs(state),
    trip,
    transportDraft: {
      outboundLegs: state.outboundLegs,
      returnLegs: state.returnLegs,
      intercityLegs: state.intercityLegs,
      dayPlaces: stored,
    },
    gridStart,
    gridEnd,
  }).dayPlaces;
}
