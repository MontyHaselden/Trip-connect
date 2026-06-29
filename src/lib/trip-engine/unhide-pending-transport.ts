import {
  pendingTransportNeedKey,
} from "./hidden-pending-transport";
import {
  pendingTransportNeedsFromCalendar,
  transportLegCoversCityMove,
} from "./pending-city-moves";
import { allTransportLegs } from "./cost-ledger/transport-finance-product";
import type { TripEntityGraph } from "./types";
import type { PendingTransportNeed } from "./pending-city-moves";

type TransportLeg = TripEntityGraph["outboundLegs"][number];

function legStillCoversHiddenNeed(
  graph: TripEntityGraph,
  groupId: string,
  need: PendingTransportNeed,
): boolean {
  return allTransportLegs(graph).some((leg) =>
    transportLegCoversCityMove(leg, need, { scopeGroupId: groupId }),
  );
}

/** Drop hidden pending keys that no longer have a covering leg after deletes. */
export function unhidePendingNeedsUncoveredAfterLegRemoval(
  graph: TripEntityGraph,
  _removedLegs: TransportLeg[],
): TripEntityGraph {
  const keys = new Set(graph.hiddenPendingTransportNeedKeys ?? []);
  if (!keys.size) return graph;

  for (const group of graph.groups) {
    for (const need of pendingTransportNeedsFromCalendar(graph, group.id, {
      includeHidden: true,
    })) {
      const key = pendingTransportNeedKey(group.id, need);
      if (!keys.has(key)) continue;
      if (!legStillCoversHiddenNeed(graph, group.id, need)) {
        keys.delete(key);
      }
    }
  }

  return { ...graph, hiddenPendingTransportNeedKeys: [...keys] };
}
