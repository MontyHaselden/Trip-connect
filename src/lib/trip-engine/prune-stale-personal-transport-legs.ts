import type { IntercityLegDraft } from "@/lib/host/wizard/types";

import { participantUsesTransportLeg } from "./cost-ledger/presence";
import { mergeMainWithPersonalOverlay } from "./personal-location-overlay";
import { personalGroupForGroupId } from "./person-lens";
import type { ResolvedParticipantPlan } from "./resolve-participant-graph";
import { dayPlacesForGroup } from "./selectors";
import type { TripEntityGraph } from "./types";

function planForPersonalGroup(
  graph: TripEntityGraph,
  groupId: string,
): ResolvedParticipantPlan | null {
  const personal = personalGroupForGroupId(graph, groupId);
  if (!personal?.personalForParticipantId) return null;

  const mode = personal.inheritMode === "independent" ? "independent" : "overlay";
  const days =
    mode === "independent"
      ? dayPlacesForGroup(graph, groupId)
      : mergeMainWithPersonalOverlay(graph, groupId);

  const legIds = new Set(
    graph.intercityLegs.filter((leg) => leg.originGroupId === groupId).map((leg) => leg.id),
  );

  return {
    participantId: personal.personalForParticipantId,
    mode,
    daysByDate: new Map(days.map((day) => [day.date, day])),
    stayIds: new Set(
      graph.accommodationStays
        .filter((stay) => stay.originGroupId === groupId)
        .map((stay) => stay.id),
    ),
    legIds,
    activityIds: new Set(
      graph.activities
        .filter((activity) => activity.originGroupId === groupId)
        .map((activity) => activity.id),
    ),
  };
}

function legStillMatchesCalendar(
  graph: TripEntityGraph,
  plan: ResolvedParticipantPlan,
  leg: IntercityLegDraft,
): boolean {
  return participantUsesTransportLeg(plan, leg, graph);
}

/** Drop personal intercity legs that no longer match the participant calendar. */
export function pruneStalePersonalTransportLegs(
  graph: TripEntityGraph,
  groupId: string,
): TripEntityGraph {
  const plan = planForPersonalGroup(graph, groupId);
  if (!plan) return graph;

  const intercityLegs = graph.intercityLegs.filter((leg) => {
    if (leg.originGroupId !== groupId) return true;
    return legStillMatchesCalendar(graph, plan, leg);
  });

  if (intercityLegs.length === graph.intercityLegs.length) return graph;
  return { ...graph, intercityLegs };
}

export function pruneStalePersonalTransportLegsForGroups(
  graph: TripEntityGraph,
  groupIds: Iterable<string>,
): TripEntityGraph {
  let next = graph;
  for (const groupId of groupIds) {
    next = pruneStalePersonalTransportLegs(next, groupId);
  }
  return next;
}
