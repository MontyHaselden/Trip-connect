import { transportLegRouteKey } from "../group-transport-legs-for-display";
import type { TripEntityGraph } from "../types";

import { allTransportLegs } from "./transport-finance-product";
import type { CostLineItemDraft } from "./types";

function legOriginGroupId(
  graph: TripEntityGraph,
  leg: TripEntityGraph["outboundLegs"][number],
): string {
  return leg.originGroupId ?? graph.mainGroupId;
}

export function isPersonalTransportLeg(
  graph: TripEntityGraph,
  leg: TripEntityGraph["outboundLegs"][number],
): boolean {
  return legOriginGroupId(graph, leg) !== graph.mainGroupId;
}

/** Finance bucket for personal legs — one row per route, not per traveller leg id. */
export function personalTransportRouteFinanceKey(
  graph: TripEntityGraph,
  legId: string,
): string | null {
  const leg = allTransportLegs(graph).find((row) => row.id === legId);
  if (!leg || !isPersonalTransportLeg(graph, leg)) return null;
  return `transport_route:${transportLegRouteKey(leg)}`;
}

export function transportLegIdsSharingRoute(
  graph: TripEntityGraph,
  legId: string,
): string[] {
  const leg = allTransportLegs(graph).find((row) => row.id === legId);
  if (!leg) return [legId];
  if (!isPersonalTransportLeg(graph, leg)) return [legId];
  const key = transportLegRouteKey(leg);
  return allTransportLegs(graph)
    .filter(
      (row) =>
        isPersonalTransportLeg(graph, row) && transportLegRouteKey(row) === key,
    )
    .map((row) => row.id);
}

export function transportRouteAlreadySeededInLedger(
  existing: CostLineItemDraft[],
  graph: TripEntityGraph,
  seedLegId: string,
): boolean {
  const siblingIds = new Set(transportLegIdsSharingRoute(graph, seedLegId));
  return existing.some(
    (line) =>
      line.linkedTransportLegId != null &&
      siblingIds.has(line.linkedTransportLegId),
  );
}

export function financeLinkBucketKey(
  line: Pick<
    CostLineItemDraft,
    | "linkedActivityId"
    | "linkedStayId"
    | "linkedTransportLegId"
    | "linkedTransportProductId"
  >,
  graph?: TripEntityGraph | null,
): string | null {
  if (line.linkedActivityId) return `activity:${line.linkedActivityId}`;
  if (line.linkedStayId) return `stay:${line.linkedStayId}`;
  if (line.linkedTransportProductId) {
    return `transport_product:${line.linkedTransportProductId}`;
  }
  if (line.linkedTransportLegId && graph) {
    const routeKey = personalTransportRouteFinanceKey(graph, line.linkedTransportLegId);
    if (routeKey) return routeKey;
  }
  if (line.linkedTransportLegId) return `transport:${line.linkedTransportLegId}`;
  return null;
}
