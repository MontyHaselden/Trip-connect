import { placesShareMetro } from "@/lib/geo/airport-codes";

import { arrivalDate } from "./transport-day-placement";
import { newId, type TransportLegDraft, type TripWizardDraft } from "./types";

function legContinuesFromPrevious(previous: TransportLegDraft, leg: TransportLegDraft): boolean {
  const hub = previous.toCity.trim();
  if (!hub) return false;
  const from = leg.fromCity.trim();
  return !from || placesShareMetro(hub, from);
}

export function emptyTransportLeg(date = ""): TransportLegDraft {
  return {
    id: newId(),
    transportType: "plane",
    bookingStatus: "not_booked",
    travelDate: date,
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: "",
    toCity: "",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
  };
}

export function chainedTransportLeg(previous?: TransportLegDraft): TransportLegDraft {
  const leg = emptyTransportLeg();
  if (!previous?.toCity.trim()) return leg;
  const departDate = arrivalDate(previous) || previous.travelDate || "";
  return {
    ...leg,
    fromCity: previous.toCity.trim(),
    travelDate: departDate,
    departureTime: previous.arrivalTime ?? null,
  };
}

function syncLegChain(legs: TransportLegDraft[]): { legs: TransportLegDraft[]; changed: boolean } {
  if (legs.length < 2) return { legs, changed: false };

  let changed = false;
  const next = legs.map((leg, index) => {
    if (index === 0) return leg;

    const previous = legs[index - 1]!;
    if (!legContinuesFromPrevious(previous, leg)) return leg;

    const hub = previous.toCity.trim();
    const expectedDate = arrivalDate(previous) || previous.travelDate || "";
    const needsFrom = !leg.fromCity.trim();
    const needsDate =
      Boolean(expectedDate) &&
      (!leg.travelDate.trim() || leg.travelDate < expectedDate);
    const needsDepartureTime = !leg.departureTime && Boolean(previous.arrivalTime);

    if (!needsFrom && !needsDate && !needsDepartureTime) return leg;

    changed = true;
    return {
      ...leg,
      fromCity: needsFrom ? hub : leg.fromCity,
      travelDate: needsDate ? expectedDate : leg.travelDate,
      departureTime: needsDepartureTime ? previous.arrivalTime : leg.departureTime,
    };
  });

  return { legs: next, changed };
}

/** Fill empty connection legs from the prior leg's landing city. */
export function syncChainedTransportLegs(draft: TripWizardDraft): TripWizardDraft {
  const outbound = syncLegChain(draft.outboundLegs);
  const returns = syncLegChain(draft.returnLegs);
  const intercity = syncLegChain(draft.intercityLegs);
  if (!outbound.changed && !returns.changed && !intercity.changed) return draft;
  return {
    ...draft,
    outboundLegs: outbound.legs,
    returnLegs: returns.legs,
    intercityLegs: intercity.legs as TripWizardDraft["intercityLegs"],
  };
}

/** Sync a batch of flights added as one connection chain (e.g. multi-leg form). */
export function syncConsecutiveFlightLegs<T extends TransportLegDraft>(legs: T[]): T[] {
  if (legs.length < 2) return legs;
  return syncLegChain(legs).legs as T[];
}

export function legRouteLabel(leg: TransportLegDraft): string {
  const from = leg.fromCity.trim() || "—";
  const to = leg.toCity.trim() || "—";
  return `${from} → ${to}`;
}

export function outboundLegTitle(index: number): string {
  return index === 0 ? "Outbound flight" : `Connection ${index}`;
}

export function returnLegTitle(index: number): string {
  return index === 0 ? "Return flight" : `Return connection ${index}`;
}

export function connectionLegHint(previous?: TransportLegDraft): string | undefined {
  const hub = previous?.toCity.trim();
  return hub ? `Continuing from ${hub}` : undefined;
}

export function firstOutboundLeg(
  startDate: string,
  departureCity: string,
  defaultAirport?: string,
): TransportLegDraft {
  const fromCity = defaultAirport?.trim() || departureCity;
  return {
    ...emptyTransportLeg(startDate),
    fromCity,
  };
}

export function firstReturnLeg(endDate: string, returnCity: string): TransportLegDraft {
  return {
    ...emptyTransportLeg(endDate),
    toCity: returnCity,
  };
}
