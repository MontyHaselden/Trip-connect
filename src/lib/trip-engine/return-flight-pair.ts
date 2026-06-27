import { DateTime } from "luxon";

import { airportCodeFromPlace, placesShareMetro } from "@/lib/geo/airport-codes";
import { shortCityName } from "@/lib/host/setup/location-range-display";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type { CityMove } from "@/lib/host/wizard/detect-city-moves";
import type { PendingTransportNeed } from "./pending-city-moves";
import type { TransportLegDraft } from "@/lib/host/wizard/types";
import { pendingTransportNeedsFromCalendar } from "./pending-city-moves";
import type { TripEntityGraph } from "./types";
import {
  findLegPlacement,
  isReverseFlightPair,
  type PlacedTransportLeg,
} from "./flight-package-pairs";

export type ReturnFlightPair =
  | {
      kind: "pending";
      outbound: PendingTransportNeed;
      return: PendingTransportNeed;
    }
  | {
      kind: "mixed";
      outbound: PendingTransportNeed;
      returnLeg: PlacedTransportLeg;
    }
  | {
      kind: "mixed";
      outboundLeg: PlacedTransportLeg;
      return: PendingTransportNeed;
    };

function movesAreReversePair(a: CityMove, b: CityMove): boolean {
  return (
    (locationsMatch(a.fromCity, b.toCity) || placesShareMetro(a.fromCity, b.toCity)) &&
    (locationsMatch(a.toCity, b.fromCity) || placesShareMetro(a.toCity, b.fromCity))
  );
}

function isHomeFlightNeed(need: PendingTransportNeed): boolean {
  return need.kind === "outbound_flight" || need.kind === "return_flight";
}

function stubLegFromNeed(need: PendingTransportNeed) {
  return {
    transportType: "plane" as const,
    fromCity: need.fromCity,
    toCity: need.toCity,
    travelDate: need.date,
  };
}

/** Both calendar gaps for a return flight package, if the reverse leg is also uncovered. */
export function findReturnFlightPairForNeed(
  graph: TripEntityGraph,
  groupId: string,
  need: PendingTransportNeed,
  pendingNeeds?: PendingTransportNeed[],
): ReturnFlightPair | null {
  if (!isHomeFlightNeed(need)) return null;

  const pending = pendingNeeds ?? pendingTransportNeedsFromCalendar(graph, groupId);
  const stub = stubLegFromNeed(need);

  const pairedPending = pending.find(
    (other) =>
      other !== need &&
      isHomeFlightNeed(other) &&
      movesAreReversePair(need, other),
  );
  if (pairedPending) {
    const outbound =
      need.kind === "outbound_flight"
        ? need
        : pairedPending.kind === "outbound_flight"
          ? pairedPending
          : need.date <= pairedPending.date
            ? need
            : pairedPending;
    const returnLeg =
      outbound === need
        ? pairedPending
        : need;
    return { kind: "pending", outbound, return: returnLeg };
  }

  for (const placed of [
    ...graph.outboundLegs.map((leg) => ({ bucket: "outbound" as const, leg })),
    ...graph.returnLegs.map((leg) => ({ bucket: "return" as const, leg })),
    ...graph.intercityLegs.map((leg) => ({ bucket: "intercity" as const, leg })),
  ]) {
    if (placed.leg.transportType !== "plane") continue;
    if (placed.leg.transportProductId) continue;
    if (!isReverseFlightPair(stub, placed.leg)) continue;

    if (need.kind === "outbound_flight") {
      return { kind: "mixed", outbound: need, returnLeg: placed };
    }
    if (need.kind === "return_flight") {
      return { kind: "mixed", outboundLeg: placed, return: need };
    }
  }

  return null;
}

function formatLegDate(iso: string): string {
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat("d MMM") : iso;
}

function outboundRouteLabel(fromCity: string, toCity: string): string {
  return `${airportCodeFromPlace(fromCity)} → ${shortCityName(toCity)}`;
}

function returnRouteLabel(fromCity: string, toCity: string): string {
  return `${shortCityName(fromCity)} → ${airportCodeFromPlace(toCity)}`;
}

function outboundFromPair(pair: ReturnFlightPair): {
  fromCity: string;
  toCity: string;
  date: string;
} {
  if (pair.kind === "pending") return pair.outbound;
  if ("outbound" in pair) return pair.outbound;
  const leg = pair.outboundLeg.leg;
  return {
    fromCity: leg.fromCity,
    toCity: leg.toCity,
    date: leg.travelDate,
  };
}

function returnFromPair(pair: ReturnFlightPair): {
  fromCity: string;
  toCity: string;
  date: string;
} {
  if (pair.kind === "pending") return pair.return;
  if ("return" in pair) return pair.return;
  const leg = pair.returnLeg.leg;
  return {
    fromCity: leg.fromCity,
    toCity: leg.toCity,
    date: leg.travelDate,
  };
}

/** e.g. "CHC to Tokyo return" */
export function returnFlightPackageName(pair: ReturnFlightPair): string {
  const outbound = outboundFromPair(pair);
  const home = airportCodeFromPlace(outbound.fromCity);
  const dest = shortCityName(outbound.toCity);
  return `${home} to ${dest} return`;
}

export function returnFlightPairSummary(pair: ReturnFlightPair): {
  packageTitle: string;
  outboundDate: string;
  outboundRoute: string;
  returnDate: string;
  returnRoute: string;
} {
  const outbound = outboundFromPair(pair);
  const returnLeg = returnFromPair(pair);
  return {
    packageTitle: returnFlightPackageName(pair),
    outboundDate: formatLegDate(outbound.date),
    outboundRoute: outboundRouteLabel(outbound.fromCity, outbound.toCity),
    returnDate: formatLegDate(returnLeg.date),
    returnRoute: returnRouteLabel(returnLeg.fromCity, returnLeg.toCity),
  };
}

export function returnFlightPackageSummaryFromLegs(
  outbound: Pick<TransportLegDraft, "fromCity" | "toCity" | "travelDate">,
  returnLeg: Pick<TransportLegDraft, "fromCity" | "toCity" | "travelDate">,
): ReturnType<typeof returnFlightPairSummary> {
  return returnFlightPairSummary({
    kind: "pending",
    outbound: {
      kind: "outbound_flight",
      fromCity: outbound.fromCity,
      toCity: outbound.toCity,
      date: outbound.travelDate,
    },
    return: {
      kind: "return_flight",
      fromCity: returnLeg.fromCity,
      toCity: returnLeg.toCity,
      date: returnLeg.travelDate,
    },
  });
}

export function pairedLegId(pair: ReturnFlightPair): string | null {
  if (pair.kind === "mixed" && "returnLeg" in pair) return pair.returnLeg.leg.id;
  if (pair.kind === "mixed" && "outboundLeg" in pair) return pair.outboundLeg.leg.id;
  return null;
}

export function pairedLegPlacement(
  graph: TripEntityGraph,
  pair: ReturnFlightPair,
): PlacedTransportLeg | null {
  const id = pairedLegId(pair);
  if (!id) return null;
  return findLegPlacement(graph, id);
}
