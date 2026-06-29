import { personalGroupForGroupId } from "./person-lens";
import type { TripEntityGraph } from "./types";

/** Drop a personal group's overrides and return them to the whole-group plan. */
export function resetPersonalGroupFromMain(
  graph: TripEntityGraph,
  groupId: string,
): TripEntityGraph {
  const personal = personalGroupForGroupId(graph, groupId);
  const participantId = personal?.personalForParticipantId;

  let next: TripEntityGraph = {
    ...graph,
    groups: graph.groups.map((g) =>
      g.id === groupId ? { ...g, inheritMode: null } : g,
    ),
    dayPlacesByGroupId: {
      ...graph.dayPlacesByGroupId,
      [groupId]: [],
    },
    accommodationStays: graph.accommodationStays.filter(
      (stay) => stay.originGroupId !== groupId,
    ),
    outboundLegs: graph.outboundLegs.filter((leg) => leg.originGroupId !== groupId),
    returnLegs: graph.returnLegs.filter((leg) => leg.originGroupId !== groupId),
    intercityLegs: graph.intercityLegs.filter((leg) => leg.originGroupId !== groupId),
    activities: graph.activities.filter((activity) => activity.originGroupId !== groupId),
    overlayOps: graph.overlayOps.filter((op) => op.groupId !== groupId),
    hiddenPendingTransportNeedKeys: (graph.hiddenPendingTransportNeedKeys ?? []).filter(
      (key) => !key.startsWith(`${groupId}|`),
    ),
  };

  if (participantId) {
    next = {
      ...next,
      transportProducts: (next.transportProducts ?? []).map((product) => ({
        ...product,
        participantIds: product.participantIds.filter((id) => id !== participantId),
      })),
    };
  }

  return next;
}
