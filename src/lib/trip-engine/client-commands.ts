import { graphToSetupState, setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import type { TripCommand } from "./commands";
import type { TripSetupState } from "@/lib/host/setup/types";

/** Apply engine commands to client setup state (no trip id required). */
export function applySetupCommands(
  state: TripSetupState,
  commands: TripCommand[],
): TripSetupState {
  const result = applyCommands(setupStateToGraph("local", state), commands);
  return graphToSetupState(result.graph);
}

export function removeStayFromState(
  state: TripSetupState,
  stayId: string,
  groupId?: string,
): TripSetupState {
  const gid = groupId ?? state.mainGroupId;
  return applySetupCommands(state, [{ type: "removeStay", groupId: gid, stayId }]);
}

export function addStayToState(
  state: TripSetupState,
  stay: import("@/lib/host/wizard/types").AccommodationStayDraft,
  groupId?: string,
): TripSetupState {
  const gid = groupId ?? state.mainGroupId;
  return applySetupCommands(state, [{ type: "addStay", stay, groupId: gid }]);
}

export function updateStayInState(
  state: TripSetupState,
  stayId: string,
  patch: Partial<import("@/lib/host/wizard/types").AccommodationStayDraft>,
  groupId?: string,
): TripSetupState {
  const gid = groupId ?? state.mainGroupId;
  return applySetupCommands(state, [{ type: "updateStay", groupId: gid, stayId, patch }]);
}

export function addOverlayOpToState(
  state: TripSetupState,
  op: import("@/lib/host/setup/types").GroupOverlayOpDraft,
): TripSetupState {
  return applySetupCommands(state, [{ type: "addGroupDayOverride", groupId: op.groupId, op }]);
}

export function removeOverlayOpFromState(
  state: TripSetupState,
  groupId: string,
  opId: string,
): TripSetupState {
  return applySetupCommands(state, [{ type: "removeGroupDayOverride", groupId, opId }]);
}
