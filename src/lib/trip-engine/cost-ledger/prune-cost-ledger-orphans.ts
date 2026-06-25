import type { TripEntityGraph } from "../types";

import type { CostLedgerProjection } from "./types";

function linkedEntityIds(graph: TripEntityGraph) {
  return {
    activityIds: new Set(graph.activities.map((activity) => activity.id)),
    stayIds: new Set(graph.accommodationStays.map((stay) => stay.id)),
    legIds: new Set(
      [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs].map((leg) => leg.id),
    ),
    productIds: new Set((graph.transportProducts ?? []).map((product) => product.id)),
  };
}

/** Drop finance rows whose linked calendar entity no longer exists. */
export function pruneCostLedgerLinkedOrphans(
  ledger: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
): CostLedgerProjection | null | undefined {
  if (!ledger) return ledger;

  const { activityIds, stayIds, legIds, productIds } = linkedEntityIds(graph);
  const lineItems = ledger.lineItems.filter((line) => {
    if (line.linkedActivityId && !activityIds.has(line.linkedActivityId)) return false;
    if (line.linkedStayId && !stayIds.has(line.linkedStayId)) return false;
    if (line.linkedTransportProductId && !productIds.has(line.linkedTransportProductId)) {
      return false;
    }
    if (line.linkedTransportLegId && !legIds.has(line.linkedTransportLegId)) return false;
    return true;
  });

  if (lineItems.length === ledger.lineItems.length) return ledger;

  const keepIds = new Set(lineItems.map((line) => line.id));
  return {
    ...ledger,
    lineItems,
    lineAllocations: ledger.lineAllocations.filter((row) => keepIds.has(row.lineItemId)),
  };
}

export function linkedEntityExistsInGraph(
  line: CostLedgerProjection["lineItems"][number],
  graph: TripEntityGraph,
): boolean {
  if (line.linkedActivityId) {
    return graph.activities.some((activity) => activity.id === line.linkedActivityId);
  }
  if (line.linkedStayId) {
    return graph.accommodationStays.some((stay) => stay.id === line.linkedStayId);
  }
  if (line.linkedTransportProductId) {
    return (graph.transportProducts ?? []).some(
      (product) => product.id === line.linkedTransportProductId,
    );
  }
  if (line.linkedTransportLegId) {
    return [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs].some(
      (leg) => leg.id === line.linkedTransportLegId,
    );
  }
  return true;
}
