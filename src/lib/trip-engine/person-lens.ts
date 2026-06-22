import type { TripEntityGraph } from "./types";
import type { RosterSummary } from "./types";

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
): "following_main" | "custom_overlay" | "custom_independent" | null {
  const personal = personalGroupForParticipant(graph, participantId);
  if (!personal) return "following_main";
  if (personal.inheritMode === "independent") return "custom_independent";
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
