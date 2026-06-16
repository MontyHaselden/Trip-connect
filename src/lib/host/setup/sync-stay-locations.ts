import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TripWizardDraft,
} from "@/lib/host/wizard/types";

export function dayPlacesFromStays(input: {
  stays: AccommodationStayDraft[];
  intercityLegs: IntercityLegDraft[];
  trip: { startDate: string; endDate: string; departureCity: string; returnCity: string };
  transportDraft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">;
  gridStart: string;
  gridEnd: string;
}): DayPlaceDraft[] {
  const derived = deriveCalendarState({
    ...input,
    transportDraft: { ...input.transportDraft, dayPlaces: [] },
    overlayStoredLocationGaps: false,
  });
  return derived.dayPlaces.filter(
    (d) => d.primaryCity.trim() || d.secondaryCity?.trim(),
  );
}

/** Extend or shrink a named stay so location and accommodation share the same span. */
export function extendNamedStayToRange(
  stays: AccommodationStayDraft[],
  stayId: string,
  rangeStart: string,
  rangeEnd: string,
  cityLabel: string,
): AccommodationStayDraft[] {
  const checkout = addDays(rangeEnd, 1);
  return stays.map((stay) => {
    if (stay.id !== stayId) return stay;
    return {
      ...stay,
      cityLabel,
      checkInDate: rangeStart < stay.checkInDate ? rangeStart : stay.checkInDate,
      checkOutDate: checkout > stay.checkOutDate ? checkout : stay.checkOutDate,
    };
  });
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
