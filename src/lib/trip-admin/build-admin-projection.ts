import { isCalendarSubgroup } from "@/lib/trip-engine/person-lens";
import {
  hiddenPendingTransportForScope,
  pendingTransportForScope,
} from "./pending-needs-by-scope";
import { projectCalendar } from "@/lib/trip-engine/project-calendar";
import {
  activitiesForGroup,
  legsForGroup,
} from "@/lib/trip-engine/selectors";
import {
  scopeTitleForGroup,
  staysForAccommodationScopeListing,
} from "@/lib/trip-engine/section-scope-lists";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

import type { AdminScopeSection, TripAdminProjection } from "./types";

function itemOriginGroupId(
  originGroupId: string | null | undefined,
  graph: TripEntityGraph,
): string {
  return originGroupId ?? graph.mainGroupId;
}

function participantIdsForGroup(
  graph: TripEntityGraph,
  roster: RosterSummary,
  groupId: string,
): string[] {
  const group = graph.groups.find((g) => g.id === groupId);
  if (group?.personalForParticipantId) return [group.personalForParticipantId];
  return roster.participants
    .filter((p) => p.groupIds.includes(groupId))
    .map((p) => p.id);
}

function calendarDiffersFromMain(graph: TripEntityGraph, groupId: string): boolean {
  if (groupId === graph.mainGroupId) return false;

  const mainDays = projectCalendar(graph, { groupId: graph.mainGroupId }).days;
  const scopeDays = projectCalendar(graph, { groupId }).days;

  if (mainDays.length !== scopeDays.length) return true;

  for (let i = 0; i < mainDays.length; i++) {
    const main = mainDays[i]!;
    const scope = scopeDays[i]!;
    if (main.date !== scope.date) return true;
    if (main.primaryCity !== scope.primaryCity) return true;
    if (main.secondaryCity !== scope.secondaryCity) return true;
    if (main.primaryShare !== scope.primaryShare) return true;
    if (main.dayType !== scope.dayType) return true;
  }

  return false;
}

function collectAdminScopeGroupIds(graph: TripEntityGraph): string[] {
  const ids = new Set<string>();

  for (const group of graph.groups) {
    if (group.id !== graph.mainGroupId) ids.add(group.id);
  }

  for (const stay of graph.accommodationStays) {
    const gid = itemOriginGroupId(stay.originGroupId, graph);
    if (gid !== graph.mainGroupId) ids.add(gid);
  }

  for (const leg of graph.intercityLegs) {
    const gid = itemOriginGroupId(leg.originGroupId, graph);
    if (gid !== graph.mainGroupId) ids.add(gid);
  }

  for (const activity of graph.activities) {
    const gid = itemOriginGroupId(activity.originGroupId, graph);
    if (gid !== graph.mainGroupId) ids.add(gid);
  }

  for (const [groupId, days] of Object.entries(graph.dayPlacesByGroupId)) {
    if (groupId !== graph.mainGroupId && days.length > 0) ids.add(groupId);
  }

  return [...ids].sort((a, b) => {
    const titleA = graph.groups.find((g) => g.id === a)?.name ?? a;
    const titleB = graph.groups.find((g) => g.id === b)?.name ?? b;
    return titleA.localeCompare(titleB);
  });
}

function scopeHasEntities(section: AdminScopeSection): boolean {
  return (
    section.stays.length > 0 ||
    section.legs.intercity.length > 0 ||
    section.activities.length > 0 ||
    section.pendingTransport.length > 0
  );
}

function buildScopeSection(
  graph: TripEntityGraph,
  roster: RosterSummary,
  groupId: string,
): AdminScopeSection {
  const { title, memberNames } = scopeTitleForGroup(graph, roster, groupId);
  const legs = legsForGroup(graph, groupId);

  return {
    groupId,
    title,
    memberNames,
    participantIds: participantIdsForGroup(graph, roster, groupId),
    calendar: projectCalendar(graph, { groupId }),
    stays: staysForAccommodationScopeListing(graph, groupId),
    legs,
    activities: activitiesForGroup(graph, groupId),
    pendingTransport: pendingTransportForScope(graph, groupId),
    hiddenPendingTransport: hiddenPendingTransportForScope(graph, groupId),
    differsFromMain: calendarDiffersFromMain(graph, groupId),
  };
}

export function buildTripAdminProjection(
  graph: TripEntityGraph,
  roster: RosterSummary,
): TripAdminProjection {
  const wholeGroup = buildScopeSection(graph, roster, graph.mainGroupId);

  const personalScopes = collectAdminScopeGroupIds(graph)
    .map((groupId) => buildScopeSection(graph, roster, groupId))
    .filter((scope) => scope.differsFromMain || scopeHasEntities(scope))
    .sort((a, b) => a.title.localeCompare(b.title));

  return { wholeGroup, personalScopes };
}

/** All homestay period stays across every admin scope (for the homestays panel). */
export function allHomestayStaysFromProjection(
  projection: TripAdminProjection,
): Array<{ stay: AdminScopeSection["stays"][number]; scope: AdminScopeSection }> {
  const rows: Array<{ stay: AdminScopeSection["stays"][number]; scope: AdminScopeSection }> = [];
  const scopes = [projection.wholeGroup, ...projection.personalScopes];

  for (const scope of scopes) {
    for (const stay of scope.stays) {
      if (stay.stayType === "homestay" && stay.isHomestayGroup) {
        rows.push({ stay, scope });
      }
    }
  }

  return rows;
}

export function isPersonalOrSubgroupScope(
  graph: TripEntityGraph,
  groupId: string,
): boolean {
  if (groupId === graph.mainGroupId) return false;
  const group = graph.groups.find((g) => g.id === groupId);
  if (!group) return true;
  return Boolean(group.personalForParticipantId) || isCalendarSubgroup(group);
}
