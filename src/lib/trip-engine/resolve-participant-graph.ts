import { locationPaletteKey } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { SetupGroup } from "@/lib/host/setup/types";
import type { RosterSummary, TripEntityGraph } from "./types";

export type ResolvedParticipantPlan = {
  participantId: string;
  mode: "main" | "overlay" | "independent";
  daysByDate: Map<string, DayPlaceDraft>;
  stayIds: Set<string>;
  legIds: Set<string>;
  activityIds: Set<string>;
};

function participantSubgroupIds(
  roster: RosterSummary,
  participantId: string,
  mainGroupId: string,
): Set<string> {
  const person = roster.participants.find((p) => p.id === participantId);
  if (!person) return new Set();
  return new Set(
    person.groupIds.filter((gid) => gid !== mainGroupId),
  );
}

function personalGroup(
  graph: TripEntityGraph,
  participantId: string,
): SetupGroup | undefined {
  return graph.groups.find(
    (g) => g.personalForParticipantId === participantId && !g.isMain,
  );
}

function groupInheritMode(group: SetupGroup | undefined): "overlay" | "independent" | null {
  if (!group?.inheritMode) return null;
  return group.inheritMode === "independent" ? "independent" : "overlay";
}

function dayPlacesForGroups(
  graph: TripEntityGraph,
  groupIds: Iterable<string>,
): DayPlaceDraft[] {
  const out: DayPlaceDraft[] = [];
  for (const gid of groupIds) {
    out.push(...(graph.dayPlacesByGroupId[gid] ?? []));
  }
  return out;
}

function mergeDaysForParticipant(
  graph: TripEntityGraph,
  subgroupIds: Set<string>,
  mode: "main" | "overlay" | "independent",
): Map<string, DayPlaceDraft> {
  const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
  if (mode === "main" || subgroupIds.size === 0) {
    return new Map(mainDays.map((d) => [d.date, d]));
  }

  if (mode === "independent") {
    const overlayDays = dayPlacesForGroups(graph, subgroupIds);
    return new Map(overlayDays.map((d) => [d.date, d]));
  }

  const byDate = new Map<string, DayPlaceDraft>();
  for (const d of mainDays) byDate.set(d.date, d);
  for (const gid of subgroupIds) {
    for (const d of graph.dayPlacesByGroupId[gid] ?? []) {
      const hasPaint = Boolean(d.primaryCity.trim() || d.secondaryCity?.trim());
      if (hasPaint) byDate.set(d.date, d);
    }
  }
  return byDate;
}

function cityOnDate(day: DayPlaceDraft | undefined): string[] {
  if (!day) return [];
  const cities: string[] = [];
  if (day.primaryCity.trim()) cities.push(locationPaletteKey(day.primaryCity));
  if (day.secondaryCity?.trim()) cities.push(locationPaletteKey(day.secondaryCity));
  return cities;
}

export function resolveParticipantPlan(
  graph: TripEntityGraph,
  roster: RosterSummary,
  participantId: string,
): ResolvedParticipantPlan {
  const subgroupIds = participantSubgroupIds(roster, participantId, graph.mainGroupId);
  const personal = personalGroup(graph, participantId);
  const inherit = groupInheritMode(personal);

  let mode: ResolvedParticipantPlan["mode"] = "main";
  if (subgroupIds.size > 0) {
    mode = inherit === "independent" ? "independent" : "overlay";
  }

  const daysByDate = mergeDaysForParticipant(graph, subgroupIds, mode);

  const stayIds = new Set<string>();
  for (const stay of graph.accommodationStays) {
    const ownedBySubgroup =
      stay.originGroupId &&
      subgroupIds.has(stay.originGroupId) &&
      stay.originGroupId !== graph.mainGroupId;
    const mainOwned = !stay.originGroupId || stay.originGroupId === graph.mainGroupId;
    if (mode === "independent") {
      if (ownedBySubgroup) stayIds.add(stay.id);
      continue;
    }
    if (mainOwned || ownedBySubgroup) {
      const stayCity = locationPaletteKey(stay.cityLabel ?? "");
      let overlaps = false;
      for (const [date, day] of daysByDate) {
        if (date < stay.checkInDate || date > stay.checkOutDate) continue;
        if (cityOnDate(day).includes(stayCity)) {
          overlaps = true;
          break;
        }
      }
      if (overlaps || (mode === "main" && mainOwned)) {
        stayIds.add(stay.id);
      }
    }
  }

  const legIds = new Set<string>();
  const allLegs = [
    ...graph.outboundLegs,
    ...graph.returnLegs,
    ...graph.intercityLegs,
  ];
  for (const leg of allLegs) {
    const ownedBySubgroup =
      leg.originGroupId &&
      subgroupIds.has(leg.originGroupId) &&
      leg.originGroupId !== graph.mainGroupId;
    const mainOwned = !leg.originGroupId || leg.originGroupId === graph.mainGroupId;
    if (mode === "independent") {
      if (ownedBySubgroup) legIds.add(leg.id);
    } else if (mainOwned || ownedBySubgroup) {
      legIds.add(leg.id);
    }
  }

  const activityIds = new Set<string>();
  for (const activity of graph.activities) {
    const originGroupId = activity.originGroupId ?? null;
    const ownedBySubgroup =
      originGroupId &&
      subgroupIds.has(originGroupId) &&
      originGroupId !== graph.mainGroupId;
    const mainOwned = !originGroupId || originGroupId === graph.mainGroupId;
    if (mode === "independent") {
      if (ownedBySubgroup) activityIds.add(activity.id);
      continue;
    }
    if (activity.audienceType === "group" && activity.audienceId) {
      if (!subgroupIds.has(activity.audienceId) && activity.audienceId !== graph.mainGroupId) {
        continue;
      }
    }
    if (mainOwned || ownedBySubgroup) activityIds.add(activity.id);
  }

  return {
    participantId,
    mode,
    daysByDate,
    stayIds,
    legIds,
    activityIds,
  };
}

export function resolveAllParticipantPlans(
  graph: TripEntityGraph,
  roster: RosterSummary,
): Map<string, ResolvedParticipantPlan> {
  const map = new Map<string, ResolvedParticipantPlan>();
  for (const p of roster.participants) {
    map.set(p.id, resolveParticipantPlan(graph, roster, p.id));
  }
  return map;
}

export function citiesForParticipantOnDate(
  plan: ResolvedParticipantPlan,
  date: string,
): string[] {
  return cityOnDate(plan.daysByDate.get(date));
}
