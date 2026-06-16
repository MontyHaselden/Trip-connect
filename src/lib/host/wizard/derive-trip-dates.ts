import { isAirportPlace, placesShareMetro } from "@/lib/geo/airport-codes";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";

import { computeCalendarBounds } from "./calendar-bounds";
import { buildDefaultDayPlaces } from "./detect-city-moves";
import { syncChainedTransportLegs } from "./leg-chain";
import { finalReturnLeg } from "./transport-day-placement";
import type { DayPlaceDraft, TripWizardDraft } from "./types";

export type DerivedTripDates = {
  startDate: string;
  endDate: string;
};

/** Earliest leg departure in a chain — trip starts/ends when you first leave home / leave the destination. */
function earliestLegTravelDate(legs: TripWizardDraft["outboundLegs"]): string | null {
  let earliest: string | null = null;
  for (const leg of legs) {
    const date = leg.travelDate.trim();
    if (!date) continue;
    if (!earliest || date < earliest) earliest = date;
  }
  return earliest;
}

/** Trip starts on outbound departure; ends on return departure (buffer day after is arrival home). */
export function deriveTripDatesFromTransport(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs">,
): DerivedTripDates | null {
  const outboundDate = earliestLegTravelDate(draft.outboundLegs);
  const returnDate = earliestLegTravelDate(draft.returnLegs);
  if (!outboundDate || !returnDate || outboundDate > returnDate) return null;
  return { startDate: outboundDate, endDate: returnDate };
}

function homeCityFromLegPlace(place: string): string {
  const trimmed = place.trim();
  if (!trimmed) return "";
  return isAirportPlace(trimmed) ? metroDisplayLabel(trimmed) : trimmed;
}

function preferExistingHomeLabel(existing: string, derived: string): string {
  const kept = existing.trim();
  if (kept && derived && placesShareMetro(kept, derived)) return kept;
  return derived;
}

export function deriveCitiesFromTransport(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs"> & {
    basics?: Pick<TripWizardDraft["basics"], "departureCity" | "returnCity">;
  },
): { departureCity: string; returnCity: string } {
  const rawDep = draft.outboundLegs.find((leg) => leg.fromCity.trim())?.fromCity.trim() ?? "";
  const rawRet = finalReturnLeg(draft.returnLegs)?.toCity.trim() ?? "";
  const depDerived = rawDep ? homeCityFromLegPlace(rawDep) : "";
  const retDerived = rawRet ? homeCityFromLegPlace(rawRet) : "";
  return {
    departureCity: preferExistingHomeLabel(draft.basics?.departureCity ?? "", depDerived),
    returnCity: preferExistingHomeLabel(draft.basics?.returnCity ?? "", retDerived),
  };
}

export function resizeDayPlacesForTripRange(
  existing: DayPlaceDraft[],
  startDate: string,
  endDate: string,
  departureCity: string,
  returnCity: string,
  calendarLastDate?: string,
): DayPlaceDraft[] {
  const fresh = buildDefaultDayPlaces(
    startDate,
    endDate,
    departureCity,
    returnCity,
    calendarLastDate,
  );
  const byDate = new Map(existing.map((day) => [day.date, day]));
  return fresh.map((day) => {
    if (day.dayType === "buffer") return day;
    const prior = byDate.get(day.date);
    if (!prior || prior.dayType === "buffer") return day;
    return { ...prior, dayType: day.dayType };
  });
}

/**
 * Keep basics.startDate/endDate (and home cities) aligned with There & Back legs.
 * Rebuilds the calendar grid when the derived range changes.
 */
export function applyTransportToDraft(draft: TripWizardDraft): TripWizardDraft {
  draft = syncChainedTransportLegs(draft);
  const dates = deriveTripDatesFromTransport(draft);
  if (!dates) return draft;

  const fromTransport = deriveCitiesFromTransport(draft);
  const basics = {
    ...draft.basics,
    startDate: dates.startDate,
    endDate: dates.endDate,
    departureCity: fromTransport.departureCity || draft.basics.departureCity,
    returnCity: fromTransport.returnCity || draft.basics.returnCity,
  };

  const rangeChanged =
    basics.startDate !== draft.basics.startDate || basics.endDate !== draft.basics.endDate;
  const citiesChanged =
    basics.departureCity !== draft.basics.departureCity ||
    basics.returnCity !== draft.basics.returnCity;

  const calendarBounds = computeCalendarBounds(draft, basics);
  const lastPlaceDate = draft.dayPlaces.reduce(
    (max, day) => (day.date > max ? day.date : max),
    draft.dayPlaces[0]?.date ?? "",
  );
  const calendarExtended = Boolean(
    calendarBounds?.lastDate && lastPlaceDate && calendarBounds.lastDate > lastPlaceDate,
  );

  const dayPlaces =
    rangeChanged || citiesChanged || draft.dayPlaces.length === 0 || calendarExtended
      ? resizeDayPlacesForTripRange(
          draft.dayPlaces,
          basics.startDate,
          basics.endDate,
          basics.departureCity,
          basics.returnCity,
          calendarBounds?.lastDate,
        )
      : draft.dayPlaces;

  return {
    ...draft,
    basics,
    dayPlaces,
    datesPlacesConfirmed: rangeChanged ? false : draft.datesPlacesConfirmed,
  };
}

export function formatTripDateRange(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "";
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}
