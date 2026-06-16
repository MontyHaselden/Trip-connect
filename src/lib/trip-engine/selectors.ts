import type { ActivityDraft, AccommodationStayDraft } from "@/lib/host/wizard/types";
import type { TransportLegDraft, IntercityLegDraft } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "./types";

export function staysForGroup(graph: TripEntityGraph, groupId: string): AccommodationStayDraft[] {
  if (groupId === graph.mainGroupId) {
    return graph.accommodationStays.filter((s) => !s.originGroupId || s.originGroupId === groupId);
  }
  return graph.accommodationStays.filter((s) => s.originGroupId === groupId);
}

export function legsForGroup(
  graph: TripEntityGraph,
  groupId: string,
): {
  outbound: TransportLegDraft[];
  return: TransportLegDraft[];
  intercity: IntercityLegDraft[];
} {
  if (groupId === graph.mainGroupId) {
    return {
      outbound: graph.outboundLegs,
      return: graph.returnLegs,
      intercity: graph.intercityLegs.filter((l) => !l.originGroupId || l.originGroupId === groupId),
    };
  }
  return {
    outbound: [],
    return: [],
    intercity: graph.intercityLegs.filter((l) => l.originGroupId === groupId),
  };
}

export function activitiesForGroup(graph: TripEntityGraph, _groupId: string): ActivityDraft[] {
  return graph.activities;
}

export function dayPlacesForGroup(graph: TripEntityGraph, groupId: string) {
  return graph.dayPlacesByGroupId[groupId] ?? [];
}

export function activitiesOnDate(graph: TripEntityGraph, date: string): ActivityDraft[] {
  return graph.activities.filter((a) => {
    const end = a.endDate?.trim() || a.date;
    return a.date <= date && date <= end;
  });
}

export function allLegs(graph: TripEntityGraph): Array<TransportLegDraft | IntercityLegDraft> {
  return [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs];
}

export function legsOnDate(graph: TripEntityGraph, date: string) {
  return allLegs(graph).filter((leg) => leg.travelDate === date);
}

export function namedStays(graph: TripEntityGraph, groupId: string): AccommodationStayDraft[] {
  return staysForGroup(graph, groupId).filter((s) => s.name?.trim());
}
