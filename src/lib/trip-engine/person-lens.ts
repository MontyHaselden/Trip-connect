import type { AccommodationStayDraft, ActivityDraft } from "@/lib/host/wizard/types";

import { borrowedMainStaysForParticipant, borrowedMainActivitiesForParticipant } from "./match-main-accommodation-stay";
import { mergeActivitiesById } from "./merge-graph-activities";
import { activitiesForGroup, staysForGroup } from "./selectors";
import type { TripEntityGraph, RosterSummary } from "./types";

/** Stays visible on the calendar for this group (includes main-group stays for location overlays). */
export function staysForCalendarView(
  graph: TripEntityGraph,
  groupId: string,
): AccommodationStayDraft[] {
  if (groupId === graph.mainGroupId) return staysForGroup(graph, groupId);

  const own = staysForGroup(graph, groupId);
  const borrowed = borrowedMainStaysForParticipant(graph, groupId);
  if (borrowed.length) return [...own, ...borrowed];
  if (own.length > 0) return own;
  if (participantUsesLocationOverlayProjection(graph, groupId)) {
    return staysForGroup(graph, graph.mainGroupId);
  }
  return own;
}

export function activitiesForCalendarView(
  graph: TripEntityGraph,
  groupId: string,
): ActivityDraft[] {
  if (groupId === graph.mainGroupId) return activitiesForGroup(graph, groupId);

  const own = activitiesForGroup(graph, groupId);
  const borrowed = borrowedMainActivitiesForParticipant(graph, groupId);
  if (borrowed.length) return mergeActivitiesById(own, borrowed);
  if (own.length > 0) return own;
  if (participantUsesLocationOverlayProjection(graph, groupId)) {
    return activitiesForGroup(graph, graph.mainGroupId);
  }
  return own;
}

/** True when a stay row belongs to main and is only shown via participant location overlay. */
export function stayInheritsFromMainGroup(
  graph: TripEntityGraph,
  groupId: string,
  stay: AccommodationStayDraft,
): boolean {
  if (groupId === graph.mainGroupId) return false;
  const origin = stay.originGroupId ?? graph.mainGroupId;
  if (origin !== graph.mainGroupId) return false;
  if (participantUsesLocationOverlayProjection(graph, groupId)) return true;
  return borrowedMainStaysForParticipant(graph, groupId).some((s) => s.id === stay.id);
}

export type CalendarLens =
  | { kind: "whole_group" }
  | { kind: "person"; participantId: string }
  | { kind: "subgroup"; groupId: string }
  | { kind: "party"; participantIds: string[] };

export function isCalendarSubgroup(group: TripEntityGraph["groups"][number]): boolean {
  return !group.isMain && !group.personalForParticipantId;
}

export function calendarSubgroups(graph: TripEntityGraph): TripEntityGraph["groups"] {
  return graph.groups.filter(isCalendarSubgroup).sort((a, b) => a.name.localeCompare(b.name));
}

export function rosterParticipantIdsForGroup(
  roster: RosterSummary,
  groupId: string,
): string[] {
  return roster.participants.filter((p) => p.groupIds.includes(groupId)).map((p) => p.id);
}

export function personalGroupIdForParticipant(
  graph: TripEntityGraph,
  participantId: string,
): string | null {
  return (
    graph.groups.find((g) => g.personalForParticipantId === participantId && !g.isMain)?.id ?? null
  );
}

export function partyPersonalGroupIds(
  graph: TripEntityGraph,
  participantIds: string[],
): string[] {
  return participantIds
    .map((id) => personalGroupIdForParticipant(graph, id))
    .filter((id): id is string => Boolean(id));
}

export function normalizeCalendarLens(
  lens: CalendarLens,
  graph: TripEntityGraph,
  roster: RosterSummary,
): CalendarLens {
  if (lens.kind === "whole_group") return lens;
  if (lens.kind === "person") {
    if (roster.participants.some((p) => p.id === lens.participantId)) return lens;
    return { kind: "whole_group" };
  }
  if (lens.kind === "subgroup") {
    if (graph.groups.some((g) => g.id === lens.groupId && isCalendarSubgroup(g))) return lens;
    return { kind: "whole_group" };
  }
  if (lens.kind === "party") {
    const ids = lens.participantIds.filter((id) =>
      roster.participants.some((p) => p.id === id),
    );
    if (ids.length >= 2) return { kind: "party", participantIds: ids };
    if (ids.length === 1) return { kind: "person", participantId: ids[0]! };
    return { kind: "whole_group" };
  }
  return { kind: "whole_group" };
}

export function lensDisplayLabel(
  lens: CalendarLens,
  graph: TripEntityGraph,
  roster: RosterSummary,
): string {
  if (lens.kind === "whole_group") return "Whole group";
  if (lens.kind === "person") {
    const person = roster.participants.find((p) => p.id === lens.participantId);
    return person?.fullName?.trim() || "Participant";
  }
  if (lens.kind === "subgroup") {
    const group = graph.groups.find((g) => g.id === lens.groupId);
    const members = rosterParticipantIdsForGroup(roster, lens.groupId).length;
    const name = group?.name?.trim() || "Travel party";
    return members > 0 ? `${name} (${members})` : name;
  }
  const names = lens.participantIds
    .map((id) => roster.participants.find((p) => p.id === id)?.fullName?.trim())
    .filter(Boolean) as string[];
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Group ids whose personal/subgroup transport rows belong to this lens (null = show all). */
export function calendarLensScopeGroupIds(
  lens: CalendarLens,
  graph: TripEntityGraph,
  roster: RosterSummary,
): string[] | null {
  if (lens.kind === "whole_group") return null;
  if (lens.kind === "subgroup") return [lens.groupId];
  if (lens.kind === "person") {
    const groupId = editGroupIdForLens(graph, lens, roster);
    return groupId !== graph.mainGroupId ? [groupId] : null;
  }
  if (lens.kind === "party") {
    const ids = partyPersonalGroupIds(graph, lens.participantIds);
    return ids.length ? ids : null;
  }
  return null;
}

export function transportViewGroupIdForLens(
  graph: TripEntityGraph,
  lens: CalendarLens,
  roster: RosterSummary,
): string {
  if (lens.kind === "party") return graph.mainGroupId;
  return editGroupIdForLens(graph, lens, roster);
}

export function editGroupIdForLens(
  graph: TripEntityGraph,
  lens: CalendarLens,
  roster: RosterSummary,
): string {
  if (lens.kind === "whole_group") return graph.mainGroupId;

  if (lens.kind === "subgroup") {
    if (graph.groups.some((g) => g.id === lens.groupId && isCalendarSubgroup(g))) {
      return lens.groupId;
    }
    return graph.mainGroupId;
  }

  if (lens.kind === "party") {
    const sorted = [...lens.participantIds].sort((a, b) => {
      const na = roster.participants.find((p) => p.id === a)?.fullName ?? "";
      const nb = roster.participants.find((p) => p.id === b)?.fullName ?? "";
      return na.localeCompare(nb);
    });
    for (const participantId of sorted) {
      const personalGroupId = personalGroupIdForParticipant(graph, participantId);
      if (personalGroupId) return personalGroupId;
    }
    return graph.mainGroupId;
  }

  const person = roster.participants.find((p) => p.id === lens.participantId);
  if (!person) return graph.mainGroupId;

  const personal = graph.groups.find(
    (g) => g.personalForParticipantId === lens.participantId && !g.isMain,
  );
  if (personal) return personal.id;

  const subgroup = person.groupIds.find((gid) => gid !== graph.mainGroupId);
  return subgroup ?? graph.mainGroupId;
}

export function personalGroupForParticipant(
  graph: TripEntityGraph,
  participantId: string,
) {
  return graph.groups.find(
    (g) => g.personalForParticipantId === participantId && !g.isMain,
  );
}

/** True when a participant's personal group still has stored overrides. */
export function participantHasCustomOverrides(
  graph: TripEntityGraph,
  participantId: string,
): boolean {
  const personal = personalGroupForParticipant(graph, participantId);
  if (!personal) return false;

  const groupId = personal.id;
  const dayPlaces = graph.dayPlacesByGroupId[groupId] ?? [];
  const hasLocationOverlay = dayPlaces.length > 0;

  return (
    hasLocationOverlay ||
    graph.accommodationStays.some((s) => s.originGroupId === groupId) ||
    graph.intercityLegs.some((l) => l.originGroupId === groupId) ||
    graph.activities.some((a) => a.originGroupId === groupId) ||
    graph.overlayOps.some((o) => o.groupId === groupId)
  );
}

export function personalGroupForGroupId(graph: TripEntityGraph, groupId: string) {
  return graph.groups.find(
    (g) => g.id === groupId && !g.isMain && g.personalForParticipantId,
  );
}

/** Participant only swapped cities — no personal stays, transport, or activities. */
export function participantHasLocationOnlyOverrides(
  graph: TripEntityGraph,
  participantId: string,
): boolean {
  const personal = personalGroupForParticipant(graph, participantId);
  if (!personal) return false;

  const groupId = personal.id;
  const dayPlaces = graph.dayPlacesByGroupId[groupId] ?? [];
  if (!dayPlaces.length) return false;

  return !(
    graph.accommodationStays.some((s) => s.originGroupId === groupId) ||
    graph.intercityLegs.some((l) => l.originGroupId === groupId) ||
    graph.activities.some((a) => a.originGroupId === groupId) ||
    graph.overlayOps.some((o) => o.groupId === groupId)
  );
}

/** Calendar storage mode for a personal group. */
export function groupCalendarMode(
  graph: TripEntityGraph,
  groupId: string,
): "inherit" | "override" {
  if (groupId === graph.mainGroupId) return "inherit";
  const personal = personalGroupForGroupId(graph, groupId);
  if (!personal) return "inherit";
  if (personal.inheritMode === "independent" || personal.inheritMode === "overlay") {
    return "override";
  }
  if (participantInheritsMainCalendar(graph, groupId)) return "inherit";
  return "override";
}

/** Project participant calendar from main plan + location overlay only. */
export function participantUsesLocationOverlayProjection(
  graph: TripEntityGraph,
  groupId: string,
): boolean {
  const personal = personalGroupForGroupId(graph, groupId);
  if (!personal?.personalForParticipantId) return false;
  if (personal.inheritMode === "independent") return false;
  return participantHasLocationOnlyOverrides(graph, personal.personalForParticipantId);
}

/** Participant can drop overrides and inherit the main group plan again. */
export function canResyncParticipantFromMain(
  graph: TripEntityGraph,
  participantId: string,
): boolean {
  const personal = personalGroupForParticipant(graph, participantId);
  if (personal) return true;
  return planModeLabel(graph, participantId) !== "following_main";
}

/** Participant lens should show the main group calendar verbatim (no re-derive). */
export function participantInheritsMainCalendar(
  graph: TripEntityGraph,
  groupId: string,
): boolean {
  if (groupId === graph.mainGroupId) return true;
  const personal = graph.groups.find(
    (g) => g.id === groupId && !g.isMain && g.personalForParticipantId,
  );
  if (!personal?.personalForParticipantId) return false;
  if (personal.inheritMode === "independent") return false;
  return !participantHasCustomOverrides(graph, personal.personalForParticipantId);
}

export function planModeLabel(
  graph: TripEntityGraph,
  participantId: string,
): "following_main" | "custom_locations" | "custom_overlay" | "custom_independent" | null {
  const personal = personalGroupForParticipant(graph, participantId);
  if (!personal) return "following_main";
  if (personal.inheritMode === "independent") return "custom_independent";
  if (participantHasLocationOnlyOverrides(graph, participantId)) return "custom_locations";
  if (personal.inheritMode === "overlay") return "custom_overlay";
  return "following_main";
}

export function sharedSubgroupMembers(
  roster: RosterSummary,
  groupId: string,
  excludeParticipantId: string,
): string[] {
  return roster.participants
    .filter((p) => p.id !== excludeParticipantId && p.groupIds.includes(groupId))
    .map((p) => p.fullName);
}
