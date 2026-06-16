import { applyFlightLookupToLeg, type FlightLookupResult } from "./flight-lookup-types";
import { arrivalDate } from "./transport-day-placement";
import {
  chainedTransportLeg,
  firstOutboundLeg,
  firstReturnLeg,
} from "./leg-chain";
import type { IntercityLegDraft, TransportLegDraft } from "./types";
import { newId } from "./types";
import { normalizeFlightIata } from "./aerodatabox";

export type FlightChainPlacement = "outbound" | "return" | "intercity";

export function parseFlightNumbers(input: string): string[] {
  const seen = new Set<string>();
  const numbers: string[] = [];

  for (const token of input.split(/[\n,;]+/)) {
    const normalized = normalizeFlightIata(token.trim());
    if (normalized.length < 2 || seen.has(normalized)) continue;
    seen.add(normalized);
    numbers.push(normalized);
  }

  return numbers;
}

export function sortFlightLookupsByDeparture(
  lookups: FlightLookupResult[],
): FlightLookupResult[] {
  return [...lookups].sort((left, right) => {
    const leftDate = left.travelDate ?? "";
    const rightDate = right.travelDate ?? "";
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    const leftTime = left.departureTime ?? "";
    const rightTime = right.departureTime ?? "";
    return leftTime.localeCompare(rightTime);
  });
}

export function lookupHintAfterLeg(leg: TransportLegDraft): string | undefined {
  const arrival = arrivalDate(leg);
  if (/^\d{4}-\d{2}-\d{2}$/.test(arrival)) return arrival;
  if (/^\d{4}-\d{2}-\d{2}$/.test(leg.travelDate?.trim() ?? "")) return leg.travelDate.trim();
  return undefined;
}

function seedLegForPlacement(
  placement: FlightChainPlacement,
  index: number,
  previous: TransportLegDraft | undefined,
  seed: {
    startDate: string;
    endDate: string;
    departureCity: string;
    returnCity: string;
    defaultAirport?: string;
  },
): TransportLegDraft {
  if (previous) return chainedTransportLeg(previous);

  if (placement === "return") {
    return firstReturnLeg(seed.endDate, seed.returnCity);
  }

  if (placement === "outbound") {
    return firstOutboundLeg(seed.startDate, seed.departureCity, seed.defaultAirport);
  }

  return chainedTransportLeg(undefined);
}

export function buildPlaneLegChain(
  lookups: FlightLookupResult[],
  options: {
    placement: FlightChainPlacement;
    seed: {
      startDate: string;
      endDate: string;
      departureCity: string;
      returnCity: string;
      defaultAirport?: string;
    };
    originGroupId?: string;
    chainFrom?: TransportLegDraft;
  },
): TransportLegDraft[] | IntercityLegDraft[] {
  const sorted = sortFlightLookupsByDeparture(lookups);
  const legs: TransportLegDraft[] = [];
  let previous = options.chainFrom;

  for (let index = 0; index < sorted.length; index += 1) {
    const lookup = sorted[index]!;
    const base =
      index === 0 && !previous
        ? seedLegForPlacement(options.placement, index, undefined, options.seed)
        : previous
          ? chainedTransportLeg(previous)
          : chainedTransportLeg(legs[legs.length - 1]);

    const leg = applyFlightLookupToLeg(base, lookup);
    legs.push(leg);
    previous = leg;
  }

  if (options.placement !== "intercity") return legs;

  return legs.map((leg, index) => {
    const fromCity = leg.fromCity.trim();
    const toCity = leg.toCity.trim();
    return {
      ...leg,
      id: newId(),
      intercityFromCity: fromCity,
      intercityToCity: toCity,
      originGroupId: options.originGroupId,
      legKind: index === 0 ? undefined : "connection",
    } satisfies IntercityLegDraft;
  });
}
