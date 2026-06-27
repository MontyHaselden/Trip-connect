import type { TripEntityGraph } from "@/lib/trip-engine/types";

import type { CalendarEditContext } from "./types";

/** Whether Add/Edit/Hide actions apply directly to this scope (vs view-only with hint). */
export function isScopeEditable(
  scopeId: string,
  editContext: CalendarEditContext,
  graph: TripEntityGraph,
): boolean {
  if (scopeId === graph.mainGroupId) return true;
  if (scopeId === editContext.editGroupId) return true;
  if (
    editContext.lens.kind === "party" &&
    editContext.partyGroupIds?.includes(scopeId)
  ) {
    return true;
  }
  return false;
}

export function scopeEditHint(
  scopeId: string,
  scopeTitle: string,
  editContext: CalendarEditContext,
  graph: TripEntityGraph,
): string | null {
  if (isScopeEditable(scopeId, editContext, graph)) return null;
  if (scopeId === graph.mainGroupId) return null;
  return `Edit on ${scopeTitle}'s calendar`;
}
