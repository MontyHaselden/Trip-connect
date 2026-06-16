import { mainTransportLegCount } from "./transport-leg-sync";
import type { TripSetupState } from "./types";

/** Drop a non-main group from in-memory setup state. */
export function removeGroupFromSetupState(
  state: TripSetupState,
  groupId: string,
): TripSetupState {
  if (groupId === state.mainGroupId) return state;

  const { [groupId]: _removed, ...dayPlacesByGroupId } = state.dayPlacesByGroupId;

  return {
    ...state,
    groups: state.groups.filter((g) => g.id !== groupId),
    dayPlacesByGroupId,
    overlayOps: state.overlayOps.filter((o) => o.groupId !== groupId),
    intercityLegs: state.intercityLegs.filter((l) => l.originGroupId !== groupId),
    accommodationStays: state.accommodationStays.filter((s) => s.originGroupId !== groupId),
  };
}

/** Merge a session draft over server state without resurrecting deleted groups. */
export function mergeDraftOverServer(
  draft: TripSetupState,
  server: TripSetupState,
): TripSetupState {
  const groupIds = new Set(server.groups.map((g) => g.id));
  const dayPlacesByGroupId: TripSetupState["dayPlacesByGroupId"] = {};

  for (const group of server.groups) {
    dayPlacesByGroupId[group.id] =
      draft.dayPlacesByGroupId[group.id] ?? server.dayPlacesByGroupId[group.id] ?? [];
  }

  const preferServerMainTransport =
    mainTransportLegCount(server) < mainTransportLegCount(draft);
  const mainIntercityFromServer = server.intercityLegs.filter(
    (l) => !l.originGroupId || l.originGroupId === server.mainGroupId,
  );
  const subgroupIntercityFromDraft = draft.intercityLegs.filter(
    (l) => l.originGroupId && l.originGroupId !== server.mainGroupId && groupIds.has(l.originGroupId),
  );

  return {
    ...draft,
    mainGroupId: server.mainGroupId,
    groups: server.groups,
    dayPlacesByGroupId,
    outboundLegs: preferServerMainTransport ? server.outboundLegs : draft.outboundLegs,
    returnLegs: preferServerMainTransport ? server.returnLegs : draft.returnLegs,
    intercityLegs: preferServerMainTransport
      ? [...mainIntercityFromServer, ...subgroupIntercityFromDraft]
      : draft.intercityLegs.filter(
          (l) => !l.originGroupId || groupIds.has(l.originGroupId),
        ),
    overlayOps: draft.overlayOps.filter((o) => groupIds.has(o.groupId)),
    accommodationStays: draft.accommodationStays.filter(
      (s) => !s.originGroupId || groupIds.has(s.originGroupId),
    ),
  };
}
