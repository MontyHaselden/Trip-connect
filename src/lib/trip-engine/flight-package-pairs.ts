import { locationsMatch } from "@/lib/host/wizard/location-stays";
import {
  transportLegRouteLabel,
} from "./transport-route-label";
import type { TripEntityGraph } from "./types";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

export type LegBucket = "outbound" | "return" | "intercity";

export type PlacedTransportLeg = {
  bucket: LegBucket;
  leg: TransportLegDraft | IntercityLegDraft;
};

function cityToken(city: string): string {
  return city.trim().toLowerCase().split(",")[0]?.trim() ?? "";
}

export function citiesLooselyMatch(a: string, b: string): boolean {
  const ka = cityToken(a);
  const kb = cityToken(b);
  if (!ka || !kb) return false;
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

export function isReverseFlightPair(
  a: Pick<TransportLegDraft, "transportType" | "fromCity" | "toCity">,
  b: Pick<TransportLegDraft, "transportType" | "fromCity" | "toCity">,
): boolean {
  if (a.transportType !== "plane" || b.transportType !== "plane") return false;
  return citiesLooselyMatch(a.fromCity, b.toCity) && citiesLooselyMatch(a.toCity, b.fromCity);
}

export function legRouteLabel(
  leg: TransportLegDraft | IntercityLegDraft,
  graph?: TripEntityGraph | null,
): string {
  return transportLegRouteLabel(leg, graph);
}

export function findLegPlacement(
  graph: TripEntityGraph,
  legId: string,
): PlacedTransportLeg | null {
  for (const bucket of ["outbound", "return", "intercity"] as const) {
    const list =
      bucket === "outbound"
        ? graph.outboundLegs
        : bucket === "return"
          ? graph.returnLegs
          : graph.intercityLegs;
    const leg = list.find((row) => row.id === legId);
    if (leg) return { bucket, leg };
  }
  return null;
}

export function allPlaneLegs(
  graph: TripEntityGraph,
): PlacedTransportLeg[] {
  const rows: PlacedTransportLeg[] = [];
  for (const bucket of ["outbound", "return", "intercity"] as const) {
    const list =
      bucket === "outbound"
        ? graph.outboundLegs
        : bucket === "return"
          ? graph.returnLegs
          : graph.intercityLegs;
    for (const leg of list) {
      if (leg.transportType === "plane") rows.push({ bucket, leg });
    }
  }
  return rows;
}

/** Plane legs that can be paired into a return package with the edited leg. */
export function flightPackagePairCandidates(
  graph: TripEntityGraph,
  currentLeg: TransportLegDraft | IntercityLegDraft,
): PlacedTransportLeg[] {
  return allPlaneLegs(graph)
    .filter((row) => row.leg.id !== currentLeg.id)
    .filter((row) => {
      const productId = row.leg.transportProductId;
      if (!productId) return true;
      return productId === currentLeg.transportProductId;
    })
    .sort((a, b) => {
      const aReverse = isReverseFlightPair(currentLeg, a.leg) ? 0 : 1;
      const bReverse = isReverseFlightPair(currentLeg, b.leg) ? 0 : 1;
      if (aReverse !== bReverse) return aReverse - bReverse;
      return a.leg.travelDate.localeCompare(b.leg.travelDate);
    });
}

export function defaultPairedLegId(
  graph: TripEntityGraph,
  currentLeg: TransportLegDraft | IntercityLegDraft,
): string {
  const candidates = flightPackagePairCandidates(graph, currentLeg);
  return candidates[0]?.leg.id ?? "";
}
