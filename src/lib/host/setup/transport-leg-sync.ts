import type { TripSetupState } from "./types";

export type OrphanTransportLegRow = {
  id: string;
  legKind: "outbound" | "return" | "intercity";
  originGroupId: string | null;
};

/** Main-scoped legs the UI persists on every setup save. */
export function mainTransportLegCount(state: TripSetupState): number {
  const mainGroupId = state.mainGroupId;
  const mainIntercity = state.intercityLegs.filter(
    (l) => !l.originGroupId || l.originGroupId === mainGroupId,
  ).length;
  return state.outboundLegs.length + state.returnLegs.length + mainIntercity;
}

/** Whether a DB row should be removed during main transport sync. */
export function shouldDeleteOrphanTransportLeg(
  row: OrphanTransportLegRow,
  incomingIds: ReadonlySet<string>,
  mainGroupId: string | null,
  activeGroupIds: ReadonlySet<string>,
): boolean {
  if (incomingIds.has(row.id)) return false;

  if (row.legKind === "outbound" || row.legKind === "return") return true;

  if (
    row.originGroupId &&
    row.originGroupId !== mainGroupId &&
    activeGroupIds.has(row.originGroupId)
  ) {
    return false;
  }

  return true;
}
