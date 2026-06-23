import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

import { borrowedMainStaysForParticipant } from "./match-main-accommodation-stay";
import { staysForGroup } from "./selectors";
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
  | { kind: "person"; participantId: string };

export function editGroupIdForLens(
  graph: TripEntityGraph,
  lens: CalendarLens,
  roster: RosterSummary,
): string {
  if (lens.kind === "whole_group") return graph.mainGroupId;

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
  const hasDayPaint = dayPlaces.some(
    (day) => day.primaryCity.trim() || day.secondaryCity?.trim(),
  );

  return (
    hasDayPaint ||
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
  const hasDayPaint = dayPlaces.some(
    (day) => day.primaryCity.trim() || day.secondaryCity?.trim(),
  );
  if (!hasDayPaint) return false;

  return !(
    graph.accommodationStays.some((s) => s.originGroupId === groupId) ||
    graph.intercityLegs.some((l) => l.originGroupId === groupId) ||
    graph.activities.some((a) => a.originGroupId === groupId) ||
    graph.overlayOps.some((o) => o.groupId === groupId)
  );
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
