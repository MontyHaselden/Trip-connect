import { placesShareMetro } from "@/lib/geo/airport-codes";
import { findOnwardConnectionLeg } from "@/lib/host/setup/flight-connection-chains";
import {
  arrivalDate,
  flightArrivalDates,
  flightDepartureDates,
} from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft, IntercityLegKind, TransportLegDraft, TripWizardDraft } from "./types";

export type TripBounds = {
  startDate: string;
  endDate: string;
  departureCity: string;
  returnCity: string;
};

export type AirportTransfer = {
  legKind: Extract<IntercityLegKind, "airport_arrival" | "airport_departure">;
  fromCity: string;
  toCity: string;
  date: string;
  anchorLegId: string;
};

function allFlightLegs(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs">,
): TransportLegDraft[] {
  return [...draft.outboundLegs, ...draft.returnLegs].filter(
    (leg) => leg.transportType === "plane",
  );
}

/** Painted city on the paintable portion after a flight block (arrival day). */
function paintedCityAfterFlight(day: DayPlaceDraft): string {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (secondary && share < 1) return secondary;
  if (primary && share >= 1) return primary;
  return "";
}

/** Morning city on a departure day (left / primary half). */
function paintedCityBeforeFlight(day: DayPlaceDraft): string {
  const primary = day.primaryCity.trim();
  const share = day.primaryShare ?? 1;
  if (primary && share <= 0.5 + 0.001) return primary;
  return "";
}

function sharesHome(city: string, trip: TripBounds): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;
  return (
    placesShareMetro(trimmed, trip.departureCity) ||
    placesShareMetro(trimmed, trip.returnCity)
  );
}

export function detectAirportTransfers(
  dayPlaces: DayPlaceDraft[],
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs">,
  trip: TripBounds,
): AirportTransfer[] {
  const transfers: AirportTransfer[] = [];
  const transportDraft = { ...draft, intercityLegs: [] as TripWizardDraft["intercityLegs"] };
  const arrivals = flightArrivalDates(transportDraft, trip);
  const departures = flightDepartureDates(transportDraft, trip);
  const legs = allFlightLegs(draft);
  const dayByDate = new Map(dayPlaces.map((d) => [d.date, d]));

  for (const date of arrivals) {
    const day = dayByDate.get(date);
    if (!day) continue;

    const painted = paintedCityAfterFlight(day);
    if (!painted) continue;

    const arriving = legs.find(
      (leg) =>
        leg.toCity.trim() &&
        arrivalDate(leg) === date &&
        leg.travelDate !== date,
    );
    if (!arriving || placesShareMetro(arriving.toCity, painted)) continue;

    const onward = findOnwardConnectionLeg(legs, arriving);
    if (onward && !sharesHome(onward.toCity, trip)) continue;

    if (
      sharesHome(painted, trip) &&
      sharesHome(arriving.fromCity, trip) &&
      date <= trip.startDate
    ) {
      continue;
    }

    transfers.push({
      legKind: "airport_arrival",
      fromCity: arriving.toCity.trim(),
      toCity: painted,
      date,
      anchorLegId: arriving.id,
    });
  }

  for (const date of departures) {
    const day = dayByDate.get(date);
    if (!day) continue;

    const painted = paintedCityBeforeFlight(day);
    if (!painted) continue;

    const dayDepartures = legs.filter(
      (leg) => leg.travelDate === date && leg.fromCity.trim(),
    );
    if (!dayDepartures.length) continue;

    const leavesFromPaintedMetro = dayDepartures.some((leg) =>
      placesShareMetro(leg.fromCity, painted),
    );
    if (leavesFromPaintedMetro) continue;

    const departing = dayDepartures[0]!;
    transfers.push({
      legKind: "airport_departure",
      fromCity: painted,
      toCity: departing.fromCity.trim(),
      date,
      anchorLegId: departing.id,
    });
  }

  return transfers;
}

export function intercityLegPrompt(leg: {
  legKind?: IntercityLegKind;
  intercityFromCity: string;
  intercityToCity: string;
}): string | undefined {
  const from = leg.intercityFromCity.trim();
  const to = leg.intercityToCity.trim();
  if (!from || !to) return undefined;

  if (leg.legKind === "airport_arrival") {
    return `You land at ${from} but your plan has you in ${to} — how are you getting there?`;
  }
  if (leg.legKind === "airport_departure") {
    return `Your flight leaves from ${to} but you'll be in ${from} that morning — how are you getting to the airport?`;
  }
  return undefined;
}
