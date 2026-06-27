import { placesShareMetro } from "@/lib/geo/airport-codes";
import { normalizeFlightIata } from "@/lib/host/wizard/aerodatabox";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import { TRIP_DATES_UNSET } from "@/lib/host/trip-date-display";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import type { TripSetupState } from "@/lib/host/setup/types";

export type FlightLegBucket = "outbound" | "return" | "intercity";

function isUnsetDate(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return !trimmed || trimmed === TRIP_DATES_UNSET;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Classify a single plane leg into outbound, return, or intercity. */
export function classifyFlightLeg(
  leg: TransportLegDraft,
  state: TripSetupState,
): FlightLegBucket {
  const depDate = leg.travelDate?.trim() ?? "";
  const arrDate = arrivalDate(leg);
  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());

  const firstStayIn = named
    .map((s) => s.checkInDate)
    .filter(Boolean)
    .sort()[0];
  const lastStayNight = named
    .map((s) => addDays(s.checkOutDate, -1))
    .filter(Boolean)
    .sort()
    .at(-1);

  const fromHome =
    Boolean(state.basics.departureCity.trim()) &&
    placesShareMetro(leg.fromCity, state.basics.departureCity);
  const fromDefaultAirport =
    Boolean(state.basics.defaultDepartureAirport?.trim()) &&
    placesShareMetro(leg.fromCity, state.basics.defaultDepartureAirport!);
  const toHome =
    Boolean(state.basics.returnCity.trim()) &&
    placesShareMetro(leg.toCity, state.basics.returnCity);

  if (toHome && (isUnsetDate(state.basics.endDate) || depDate >= state.basics.endDate || (lastStayNight && depDate > lastStayNight))) {
    return "return";
  }

  if ((fromHome || fromDefaultAirport) && !toHome) {
    return "outbound";
  }

  if (
    (fromHome || fromDefaultAirport) &&
    (isUnsetDate(state.basics.startDate) ||
      depDate <= state.basics.startDate ||
      (firstStayIn && depDate <= firstStayIn))
  ) {
    return "outbound";
  }

  if (firstStayIn && depDate < firstStayIn && (fromHome || fromDefaultAirport || !named.length)) {
    return "outbound";
  }

  if (lastStayNight && depDate > lastStayNight && (toHome || !named.length)) {
    return "return";
  }

  for (const stay of named) {
    const stayCity = stayCityLabel(stay);
    if (
      stayCity &&
      depDate >= stay.checkInDate &&
      depDate <= stay.checkOutDate &&
      placesShareMetro(leg.fromCity, stayCity) &&
      toHome
    ) {
      return "return";
    }
  }

  if (named.length) {
    const touchesOutboundWindow = firstStayIn && depDate < firstStayIn;
    const touchesReturnWindow = lastStayNight && arrDate >= lastStayNight;
    if (touchesOutboundWindow && !touchesReturnWindow) return "outbound";
    if (touchesReturnWindow && !touchesOutboundWindow) return "return";
    if (depDate >= (firstStayIn ?? "") && arrDate >= (lastStayNight ?? "")) return "return";
  }

  return "intercity";
}

/** Classify an imported chain — uses first/last leg signals, falls back per-leg split. */
export function classifyImportedFlightChain(
  legs: TransportLegDraft[],
  state: TripSetupState,
): Record<FlightLegBucket, TransportLegDraft[]> {
  const buckets: Record<FlightLegBucket, TransportLegDraft[]> = {
    outbound: [],
    return: [],
    intercity: [],
  };

  if (!legs.length) return buckets;

  if (legs.length === 1) {
    buckets[classifyFlightLeg(legs[0]!, state)].push(legs[0]!);
    return buckets;
  }

  const chainBucket = classifyFlightLeg(legs[0]!, state);
  const lastBucket = classifyFlightLeg(legs[legs.length - 1]!, state);

  if (chainBucket !== lastBucket) {
    for (const leg of legs) {
      buckets[classifyFlightLeg(leg, state)].push(leg);
    }
    return buckets;
  }

  if (chainBucket === "intercity") {
    for (const leg of legs) {
      buckets[classifyFlightLeg(leg, state)].push(leg);
    }
    return buckets;
  }

  buckets[chainBucket].push(...legs);
  return buckets;
}

function legMatchesFlightNumber(leg: TransportLegDraft, normalizedNumbers: Set<string>): boolean {
  const raw = leg.flightNumber?.trim();
  if (!raw) return false;
  return normalizedNumbers.has(normalizeFlightIata(raw));
}

/** Drop stale legs before re-importing the same flight number. */
export function removeLegsMatchingFlightNumbers(
  state: TripSetupState,
  flightNumbers: string[],
): TripSetupState {
  const normalized = new Set(
    flightNumbers.map((n) => normalizeFlightIata(n)).filter(Boolean),
  );
  if (!normalized.size) return state;

  return {
    ...state,
    outboundLegs: state.outboundLegs.filter((leg) => !legMatchesFlightNumber(leg, normalized)),
    returnLegs: state.returnLegs.filter((leg) => !legMatchesFlightNumber(leg, normalized)),
    intercityLegs: state.intercityLegs.filter((leg) => !legMatchesFlightNumber(leg, normalized)),
  };
}

export function mergeClassifiedLegsIntoState(
  state: TripSetupState,
  classified: Record<FlightLegBucket, TransportLegDraft[]>,
): Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs"> {
  const importedNumbers = [
    ...classified.outbound,
    ...classified.return,
    ...classified.intercity,
  ]
    .map((leg) => leg.flightNumber?.trim())
    .filter((n): n is string => Boolean(n));

  const stripped = removeLegsMatchingFlightNumbers(state, importedNumbers);

  const toIntercity = (legs: TransportLegDraft[]): IntercityLegDraft[] =>
    legs.map((leg) => ({
      ...leg,
      intercityFromCity: leg.fromCity.trim(),
      intercityToCity: leg.toCity.trim(),
      originGroupId: leg.originGroupId ?? state.mainGroupId,
    }));

  return {
    outboundLegs: [...stripped.outboundLegs, ...classified.outbound],
    returnLegs: [...stripped.returnLegs, ...classified.return],
    intercityLegs: [
      ...stripped.intercityLegs,
      ...toIntercity(classified.intercity),
    ],
  };
}

export function allPlaneLegsChronological(state: TripSetupState): Array<{
  leg: TransportLegDraft;
  bucket: FlightLegBucket;
}> {
  const rows: Array<{ leg: TransportLegDraft; bucket: FlightLegBucket; sortKey: string }> = [];

  for (const leg of state.outboundLegs) {
    rows.push({
      leg,
      bucket: "outbound",
      sortKey: `${leg.travelDate}T${leg.departureTime ?? ""}`,
    });
  }
  for (const leg of state.returnLegs) {
    rows.push({
      leg,
      bucket: "return",
      sortKey: `${leg.travelDate}T${leg.departureTime ?? ""}`,
    });
  }
  for (const leg of state.intercityLegs.filter((l) => l.transportType === "plane")) {
    rows.push({
      leg,
      bucket: "intercity",
      sortKey: `${leg.travelDate}T${leg.departureTime ?? ""}`,
    });
  }

  return rows
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ leg, bucket }) => ({ leg, bucket }));
}

export function legTitleForBucket(bucket: FlightLegBucket, index: number, leg: TransportLegDraft): string {
  const route = [leg.fromCity.trim(), leg.toCity.trim()].filter(Boolean).join(" → ") || "Flight";
  if (index === 0) return route;
  return `Connection · ${route}`;
}
