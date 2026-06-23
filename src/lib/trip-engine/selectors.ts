import type { ActivityDraft, AccommodationStayDraft } from "@/lib/host/wizard/types";
import type { TransportLegDraft, IntercityLegDraft } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "./types";

import { borrowedMainStaysForParticipant } from "./match-main-accommodation-stay";
import { personalGroupForGroupId } from "./person-lens";

export function staysForGroup(graph: TripEntityGraph, groupId: string): AccommodationStayDraft[] {
  if (groupId === graph.mainGroupId) {
    return graph.accommodationStays.filter((s) => !s.originGroupId || s.originGroupId === groupId);
  }
  return graph.accommodationStays.filter((s) => s.originGroupId === groupId);
}

/** Stays and legs that must feed calendar derivation for one group — never bleed across groups. */
export function calendarContentScopeForGroup(
  graph: TripEntityGraph,
  groupId: string,
): {
  stays: AccommodationStayDraft[];
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  intercityLegs: IntercityLegDraft[];
} {
  const legs = legsForGroup(graph, groupId);
  const ownStays = staysForGroup(graph, groupId);
  const borrowed = borrowedMainStaysForParticipant(graph, groupId);
  const personal = personalGroupForGroupId(graph, groupId);
  const stays =
    groupId === graph.mainGroupId
      ? ownStays
      : personal?.inheritMode === "independent"
        ? ownStays
        : borrowed.length
          ? [...ownStays, ...borrowed]
          : ownStays;
  return {
    stays,
    outboundLegs: groupId === graph.mainGroupId ? graph.outboundLegs : [],
    returnLegs: groupId === graph.mainGroupId ? graph.returnLegs : [],
    intercityLegs: legs.intercity,
  };
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

export function activitiesForGroup(graph: TripEntityGraph, groupId: string): ActivityDraft[] {
  if (groupId === graph.mainGroupId) {
    return graph.activities.filter(
      (a) => !a.originGroupId || a.originGroupId === graph.mainGroupId,
    );
  }
  return graph.activities.filter((a) => a.originGroupId === groupId);
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
  return allLegs(graph).filter(
    (leg) => leg.travelDate === date && !leg.surfaceOnly,
  );
}

export function namedStays(graph: TripEntityGraph, groupId: string): AccommodationStayDraft[] {
  return staysForGroup(graph, groupId).filter(
    (s) => s.name?.trim() && !(s.stayType === "homestay" && !s.isHomestayGroup),
  );
}
