import { resolveFlightForTrip } from "@/lib/host/setup/resolve-flight-for-trip";
import type { TripSetupState } from "@/lib/host/setup/types";
import { applyFlightLookupToLeg } from "@/lib/host/wizard/flight-lookup-types";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

function parseMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function legNeedsScheduleRepair(leg: TransportLegDraft): boolean {
  if (leg.transportType !== "plane") return false;
  const flight = leg.flightNumber?.trim();
  if (!flight) return false;
  const travelDate = leg.travelDate?.trim() ?? "";
  if (!travelDate) return true;
  if (!leg.departureTime?.trim() || !leg.arrivalTime?.trim()) return true;
  const dep = parseMinutes(leg.departureTime);
  const arr = parseMinutes(leg.arrivalTime);
  if (dep !== null && arr !== null && arr < dep && !leg.arrivalDate?.trim()) return true;
  return false;
}

/** Fill arrivalDate from dep/arr times when lookup already provided times. */
export function inferLegArrivalDate(leg: TransportLegDraft): TransportLegDraft {
  const travelDate = leg.travelDate?.trim() ?? "";
  if (!travelDate || leg.arrivalDate?.trim()) return leg;

  const dep = parseMinutes(leg.departureTime);
  const arr = parseMinutes(leg.arrivalTime);
  if (dep === null || arr === null) return leg;

  if (arr < dep) {
    return { ...leg, arrivalDate: addDays(travelDate, 1) };
  }
  return { ...leg, arrivalDate: null };
}

function repairLegSync(leg: TransportLegDraft): TransportLegDraft {
  return inferLegArrivalDate(leg);
}

function repairLegList<T extends TransportLegDraft>(legs: T[]): T[] {
  let changed = false;
  const next = legs.map((leg) => {
    const repaired = repairLegSync(leg);
    if (repaired !== leg) changed = true;
    return repaired as T;
  });
  return changed ? next : legs;
}

/** Synchronous schedule repair — infer overnight arrivalDate from times. */
export function repairTransportLegsSync(
  state: TripSetupState,
): Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs"> {
  const outboundLegs = repairLegList(state.outboundLegs);
  const returnLegs = repairLegList(state.returnLegs);
  const intercityLegs = repairLegList(state.intercityLegs);

  if (
    outboundLegs === state.outboundLegs &&
    returnLegs === state.returnLegs &&
    intercityLegs === state.intercityLegs
  ) {
    return {
      outboundLegs: state.outboundLegs,
      returnLegs: state.returnLegs,
      intercityLegs: state.intercityLegs,
    };
  }

  return { outboundLegs, returnLegs, intercityLegs };
}

async function repairLegFromLookup(leg: TransportLegDraft): Promise<TransportLegDraft> {
  if (!legNeedsScheduleRepair(leg)) return inferLegArrivalDate(leg);

  const flight = leg.flightNumber?.trim();
  const travelDate = leg.travelDate?.trim() ?? "";
  if (!flight || !travelDate) return leg;

  const lookup = await resolveFlightForTrip(flight, travelDate);
  if (!lookup) return inferLegArrivalDate(leg);

  const repaired = applyFlightLookupToLeg(leg, lookup);
  const ic = repaired as IntercityLegDraft;
  if (ic.intercityFromCity !== undefined) {
    return {
      ...repaired,
      intercityFromCity: repaired.fromCity.trim(),
      intercityToCity: repaired.toCity.trim(),
    } as TransportLegDraft;
  }
  return repaired;
}

/** Re-fetch schedules for legs that still lack times or overnight arrivalDate. */
export async function repairTransportLegsFromLookup(
  state: TripSetupState,
): Promise<Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">> {
  const sync = repairTransportLegsSync(state);

  async function repairAll<T extends TransportLegDraft>(legs: T[]): Promise<T[]> {
    const results: T[] = [];
    for (const leg of legs) {
      results.push((await repairLegFromLookup(leg)) as T);
    }
    return results;
  }

  const [outboundLegs, returnLegs, intercityLegs] = await Promise.all([
    repairAll(sync.outboundLegs),
    repairAll(sync.returnLegs),
    repairAll(sync.intercityLegs),
  ]);

  return { outboundLegs, returnLegs, intercityLegs };
}

export function legsStillNeedingRepair(state: TripSetupState): TransportLegDraft[] {
  const all = [...state.outboundLegs, ...state.returnLegs, ...state.intercityLegs];
  return all.filter(legNeedsScheduleRepair);
}

const TRANSPORT_TYPE_LABELS: Record<TransportLegDraft["transportType"], string> = {
  unsure: "Travel",
  plane: "Flight",
  train: "Train",
  bus: "Bus",
  coach: "Coach",
  ferry: "Ferry",
  car: "Car",
  taxi: "Transfer",
  walking: "Walking",
  other: "Travel",
};

export function legTransportTypeLabel(leg: TransportLegDraft): string {
  return TRANSPORT_TYPE_LABELS[leg.transportType] ?? "Travel";
}

export function legScheduleSummary(leg: TransportLegDraft): string {
  const dep = leg.travelDate?.trim() ?? "";
  const arr = arrivalDate(leg);
  const depTime = leg.departureTime?.trim();
  const arrTime = leg.arrivalTime?.trim();

  if (!dep) return "";

  if (arr && arr !== dep) {
    const times = [depTime ? `dep ${depTime}` : null, arrTime ? `arr ${arrTime}` : null]
      .filter(Boolean)
      .join(" → ");
    return times ? `${dep} ${times} → ${arr}` : `${dep} → ${arr}`;
  }

  const parts = [dep];
  if (depTime) parts.push(`dep ${depTime}`);
  if (arrTime) parts.push(`arr ${arrTime}`);
  if (leg.flightNumber?.trim()) parts.push(leg.flightNumber.trim());
  return parts.join(" · ");
}
