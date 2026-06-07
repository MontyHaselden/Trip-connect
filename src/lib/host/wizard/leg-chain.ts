import { arrivalDate } from "./transport-day-placement";
import { newId, type TransportLegDraft, type TripWizardDraft } from "./types";

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
    const hub = previous.toCity.trim();
    if (!hub) return leg;

    const expectedDate = arrivalDate(previous) || previous.travelDate || "";
    const needsFrom = !leg.fromCity.trim();
    const needsDate = !leg.travelDate.trim() && Boolean(expectedDate);
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
  if (!outbound.changed && !returns.changed) return draft;
  return {
    ...draft,
    outboundLegs: outbound.legs,
    returnLegs: returns.legs,
  };
}

export function legRouteLabel(leg: TransportLegDraft): string {
  const from = leg.fromCity.trim() || "—";
  const to = leg.toCity.trim() || "—";
  return `${from} → ${to}`;
}
