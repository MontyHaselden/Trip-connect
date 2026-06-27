import type {
  AccommodationStayDraft,
  ActivityDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";

import { matchingMainStayForFinanceLeg } from "./cost-ledger/accommodation-finance-leg";
import { activitiesForGroup, legsForGroup, staysForGroup } from "./selectors";
import { pendingTransportNeedsFromCalendar, hiddenPendingTransportNeedsFromCalendar, type PendingTransportNeed } from "./pending-city-moves";
import type { RosterSummary, TripEntityGraph } from "./types";

export type TripScopeSection<T> = {
  groupId: string;
  title: string;
  memberNames: string[];
  items: T[];
};

export type TripScopedLists<T> = {
  wholeGroup: TripScopeSection<T>;
  otherScopes: TripScopeSection<T>[];
};

function itemOriginGroupId(
  originGroupId: string | null | undefined,
  graph: TripEntityGraph,
): string {
  return originGroupId ?? graph.mainGroupId;
}

export function scopeTitleForGroup(
  graph: TripEntityGraph,
  roster: RosterSummary,
  groupId: string,
): { title: string; memberNames: string[] } {
  if (groupId === graph.mainGroupId) {
    return { title: "Whole group", memberNames: [] };
  }

  const group = graph.groups.find((g) => g.id === groupId);
  if (group?.personalForParticipantId) {
    const person = roster.participants.find((p) => p.id === group.personalForParticipantId);
    const name = person?.fullName?.trim() || group.name?.trim() || "Participant";
    return { title: name, memberNames: [name] };
  }

  const members = roster.participants
    .filter((p) => p.groupIds.includes(groupId))
    .map((p) => p.fullName.trim())
    .filter(Boolean);

  return {
    title: group?.name?.trim() || "Subgroup",
    memberNames: members,
  };
}

function collectOtherScopeGroupIds(
  graph: TripEntityGraph,
  originGroupIds: Array<string | null | undefined>,
  viewGroupId: string,
): string[] {
  const ids = new Set<string>();
  for (const origin of originGroupIds) {
    const gid = itemOriginGroupId(origin, graph);
    if (gid !== graph.mainGroupId) ids.add(gid);
  }
  if (viewGroupId !== graph.mainGroupId) ids.add(viewGroupId);

  const list = [...ids];
  return list;
}

function buildScopedLists<T>(
  graph: TripEntityGraph,
  roster: RosterSummary,
  viewGroupId: string,
  wholeGroupItems: T[],
  otherScopes: TripScopeSection<T>[],
): TripScopedLists<T> {
  const { title, memberNames } = scopeTitleForGroup(graph, roster, graph.mainGroupId);
  return {
    wholeGroup: {
      groupId: graph.mainGroupId,
      title,
      memberNames,
      items: wholeGroupItems,
    },
    otherScopes,
  };
}

function sortStaysChronologically(
  stays: AccommodationStayDraft[],
): AccommodationStayDraft[] {
  return [...stays].sort(
    (a, b) =>
      a.checkInDate.localeCompare(b.checkInDate) ||
      (a.name ?? "").localeCompare(b.name ?? ""),
  );
}

/** Stays to show in accommodation scope lists — hides personal rows that share a main-group leg. */
export function staysForAccommodationScopeListing(
  graph: TripEntityGraph,
  groupId: string,
): AccommodationStayDraft[] {
  const stays = staysForGroup(graph, groupId).filter((stay) => stay.name?.trim());
  if (groupId === graph.mainGroupId) return sortStaysChronologically(stays);

  const unique = stays.filter((stay) => !matchingMainStayForFinanceLeg(graph, stay));
  return sortStaysChronologically(unique);
}

export function staysListedByScope(
  graph: TripEntityGraph,
  roster: RosterSummary,
  viewGroupId: string,
): TripScopedLists<AccommodationStayDraft> {
  const otherGroupIds = collectOtherScopeGroupIds(
    graph,
    graph.accommodationStays.map((s) => s.originGroupId),
    viewGroupId,
  );

  const otherScopes = otherGroupIds
    .map((groupId) => {
      const { title, memberNames } = scopeTitleForGroup(graph, roster, groupId);
      return {
        groupId,
        title,
        memberNames,
        items: staysForAccommodationScopeListing(graph, groupId),
      };
    })
    .filter((scope) => scope.items.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));

  return buildScopedLists(
    graph,
    roster,
    viewGroupId,
    staysForAccommodationScopeListing(graph, graph.mainGroupId),
    otherScopes,
  );
}

export function activitiesListedByScope(
  graph: TripEntityGraph,
  roster: RosterSummary,
  viewGroupId: string,
): TripScopedLists<ActivityDraft> {
  const otherGroupIds = collectOtherScopeGroupIds(
    graph,
    graph.activities.map((a) => a.originGroupId),
    viewGroupId,
  );

  const otherScopes = otherGroupIds
    .map((groupId) => {
      const { title, memberNames } = scopeTitleForGroup(graph, roster, groupId);
      return {
        groupId,
        title,
        memberNames,
        items: activitiesForGroup(graph, groupId),
      };
    })
    .filter((scope) => scope.items.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));

  return buildScopedLists(
    graph,
    roster,
    viewGroupId,
    activitiesForGroup(graph, graph.mainGroupId),
    otherScopes,
  );
}

export function transportLegsListedByScope(
  graph: TripEntityGraph,
  roster: RosterSummary,
  viewGroupId: string,
): TripScopedLists<ScopedTransportLeg> {
  const mainLegs = legsForGroup(graph, graph.mainGroupId);
  const wholeGroupItems: ScopedTransportLeg[] = [
    ...mainLegs.outbound,
    ...mainLegs.return,
    ...mainLegs.intercity,
  ];

  const otherGroupIds = collectOtherScopeGroupIds(
    graph,
    graph.intercityLegs.map((l) => l.originGroupId),
    viewGroupId,
  );

  const otherScopes = otherGroupIds
    .map((groupId) => {
      const { title, memberNames } = scopeTitleForGroup(graph, roster, groupId);
      const legs = legsForGroup(graph, groupId);
      return {
        groupId,
        title,
        memberNames,
        items: [...legs.intercity] as ScopedTransportLeg[],
      };
    })
    .filter((scope) => scope.items.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));

  return buildScopedLists(graph, roster, viewGroupId, wholeGroupItems, otherScopes);
}

export type ScopedTransportLeg = TransportLegDraft | IntercityLegDraft;

function collectPendingNeedScopeGroupIds(
  graph: TripEntityGraph,
  viewGroupId: string,
  listNeeds: (groupId: string) => PendingTransportNeed[] = (groupId) =>
    pendingTransportNeedsFromCalendar(graph, groupId),
): string[] {
  const ids = new Set<string>();
  for (const groupId of Object.keys(graph.dayPlacesByGroupId)) {
    if (groupId === graph.mainGroupId) continue;
    if (listNeeds(groupId).length > 0) {
      ids.add(groupId);
    }
  }
  for (const group of graph.groups) {
    if (group.id === graph.mainGroupId) continue;
    if (listNeeds(group.id).length > 0) {
      ids.add(group.id);
    }
  }
  const list = [...ids];
  return list;
}

/** Calendar gaps that still need transport, grouped like transport legs (whole group + personal). */
export function pendingTransportNeedsListedByScope(
  graph: TripEntityGraph,
  roster: RosterSummary,
  viewGroupId: string,
): TripScopedLists<PendingTransportNeed> {
  return buildPendingNeedScopes(graph, roster, viewGroupId, (groupId) =>
    pendingTransportNeedsFromCalendar(graph, groupId),
  );
}

function buildPendingNeedScopes(
  graph: TripEntityGraph,
  roster: RosterSummary,
  viewGroupId: string,
  listNeeds: (groupId: string) => PendingTransportNeed[],
): TripScopedLists<PendingTransportNeed> {
  const otherScopes = collectPendingNeedScopeGroupIds(graph, viewGroupId, listNeeds)
    .map((groupId) => {
      const { title, memberNames } = scopeTitleForGroup(graph, roster, groupId);
      return {
        groupId,
        title,
        memberNames,
        items: listNeeds(groupId),
      };
    })
    .filter((scope) => scope.items.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title));

  return buildScopedLists(
    graph,
    roster,
    viewGroupId,
    listNeeds(graph.mainGroupId),
    otherScopes,
  );
}

/** Hidden calendar gaps grouped like visible pending transport needs. */
export function hiddenPendingTransportNeedsListedByScope(
  graph: TripEntityGraph,
  roster: RosterSummary,
  viewGroupId: string,
): TripScopedLists<PendingTransportNeed> {
  return buildPendingNeedScopes(graph, roster, viewGroupId, (groupId) =>
    hiddenPendingTransportNeedsFromCalendar(graph, groupId),
  );
}

export function pendingNeedScopeLabel(
  graph: TripEntityGraph,
  scope: Pick<TripScopeSection<unknown>, "groupId" | "title" | "memberNames">,
): string {
  if (scope.groupId === graph.mainGroupId) return "Whole group";
  const members = scopeMemberSubtitle(scope.memberNames);
  if (members && members !== scope.title) return `${scope.title} · ${members}`;
  return scope.title;
}

export function scopeMemberSubtitle(memberNames: string[]): string | null {
  if (memberNames.length === 0) return null;
  if (memberNames.length === 1) return memberNames[0]!;
  return memberNames.join(", ");
}
