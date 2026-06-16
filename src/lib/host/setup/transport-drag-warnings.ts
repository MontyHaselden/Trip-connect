import { legTouchesRange } from "@/lib/host/wizard/transport-leg-dates";
import type { DayPlaceDraft, TransportLegDraft, TripWizardDraft } from "@/lib/host/wizard/types";

import type { TripSetupState } from "./types";

function citiesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function transportLegNeedsMoveWarning(leg: TransportLegDraft): boolean {
  return leg.bookingStatus === "booked" || Boolean(leg.flightNumber?.trim());
}

export function warningReasonForLeg(leg: TransportLegDraft): string | null {
  if (leg.bookingStatus === "booked") return "This transport has a confirmed booking.";
  if (leg.flightNumber?.trim()) return "This transport has a flight number saved.";
  return null;
}

/** Find a transport leg tied to a crossover / travel day. */
export function findTransportLegOnDay(
  state: Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">,
  date: string,
  day?: DayPlaceDraft,
): TransportLegDraft | undefined {
  const all: TransportLegDraft[] = [
    ...state.outboundLegs,
    ...state.returnLegs,
    ...state.intercityLegs,
  ];

  const touching = all.filter((leg) => legTouchesRange(leg, date, date));
  if (!day) return touching.find(transportLegNeedsMoveWarning);

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";

  const cityMatch = touching.find((leg) => {
    const from = leg.fromCity.trim();
    const to = leg.toCity.trim();
    if (primary && secondary) {
      return (
        (citiesMatch(from, primary) && citiesMatch(to, secondary)) ||
        (citiesMatch(from, primary) && citiesMatch(to, secondary))
      );
    }
    return true;
  });

  return cityMatch ?? touching.find(transportLegNeedsMoveWarning);
}

export function draftLegOnDay(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">,
  date: string,
  day?: DayPlaceDraft,
): TransportLegDraft | undefined {
  return findTransportLegOnDay(draft, date, day);
}
