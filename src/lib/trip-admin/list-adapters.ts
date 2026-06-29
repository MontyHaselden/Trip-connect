import type { PendingTransportNeed } from "@/lib/trip-engine/pending-city-moves";
import type {
  ScopedTransportLeg,
  TripScopedLists,
  TripScopeSection,
} from "@/lib/trip-engine/section-scope-lists";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { AccommodationStayDraft, ActivityDraft } from "@/lib/host/wizard/types";

import type { CalendarEditContext, TripAdminProjection } from "./types";

export function calendarScopeFromProjection(
  projection: TripAdminProjection,
  editGroupId: string,
  mainGroupId: string,
): TripAdminProjection["wholeGroup"] {
  if (editGroupId === mainGroupId) return projection.wholeGroup;
  return (
    projection.personalScopes.find((scope) => scope.groupId === editGroupId) ??
    projection.wholeGroup
  );
}

export function buildCalendarEditContext(graph: TripEntityGraph): CalendarEditContext {
  return {
    lens: { kind: "whole_group" },
    editGroupId: graph.mainGroupId,
  };
}

function scopeHeader(scope: TripAdminProjection["wholeGroup"]): Pick<
  TripScopeSection<unknown>,
  "groupId" | "title" | "memberNames"
> {
  return {
    groupId: scope.groupId,
    title: scope.title,
    memberNames: scope.memberNames,
  };
}

export function transportLegsListedFromProjection(
  projection: TripAdminProjection,
): TripScopedLists<ScopedTransportLeg> {
  const wholeGroupItems: ScopedTransportLeg[] = [
    ...projection.wholeGroup.legs.outbound,
    ...projection.wholeGroup.legs.return,
    ...projection.wholeGroup.legs.intercity,
  ];

  const otherScopes = projection.personalScopes
    .map((scope) => ({
      ...scopeHeader(scope),
      items: [...scope.legs.intercity] as ScopedTransportLeg[],
    }))
    .filter((scope) => scope.items.length > 0);

  return {
    wholeGroup: {
      ...scopeHeader(projection.wholeGroup),
      items: wholeGroupItems,
    },
    otherScopes,
  };
}

export function pendingTransportListedFromProjection(
  projection: TripAdminProjection,
): TripScopedLists<PendingTransportNeed> {
  return {
    wholeGroup: {
      ...scopeHeader(projection.wholeGroup),
      items: projection.wholeGroup.pendingTransport,
    },
    otherScopes: projection.personalScopes
      .filter((scope) => scope.pendingTransport.length > 0)
      .map((scope) => ({
        ...scopeHeader(scope),
        items: scope.pendingTransport,
      })),
  };
}

export function hiddenPendingTransportListedFromProjection(
  projection: TripAdminProjection,
): TripScopedLists<PendingTransportNeed> {
  return {
    wholeGroup: {
      ...scopeHeader(projection.wholeGroup),
      items: projection.wholeGroup.hiddenPendingTransport,
    },
    otherScopes: projection.personalScopes
      .filter((scope) => scope.hiddenPendingTransport.length > 0)
      .map((scope) => ({
        ...scopeHeader(scope),
        items: scope.hiddenPendingTransport,
      })),
  };
}

export function staysListedFromProjection(
  projection: TripAdminProjection,
): TripScopedLists<AccommodationStayDraft> {
  return {
    wholeGroup: {
      ...scopeHeader(projection.wholeGroup),
      items: projection.wholeGroup.stays,
    },
    otherScopes: projection.personalScopes
      .filter((scope) => scope.stays.length > 0)
      .map((scope) => ({
        ...scopeHeader(scope),
        items: scope.stays,
      })),
  };
}

export function activitiesListedFromProjection(
  projection: TripAdminProjection,
): TripScopedLists<ActivityDraft> {
  return {
    wholeGroup: {
      ...scopeHeader(projection.wholeGroup),
      items: projection.wholeGroup.activities,
    },
    otherScopes: projection.personalScopes
      .filter((scope) => scope.activities.length > 0)
      .map((scope) => ({
        ...scopeHeader(scope),
        items: scope.activities,
      })),
  };
}
