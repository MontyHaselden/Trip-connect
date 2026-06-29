import type { TripEntityGraph } from "@/lib/trip-engine/types";

import type { CalendarEditContext } from "./types";

/** Whether Add/Edit/Hide actions apply directly to this scope (vs view-only with hint). */
export function isScopeEditable(
  scopeId: string,
  _editContext: CalendarEditContext,
  graph: TripEntityGraph,
): boolean {
  return scopeId === graph.mainGroupId;
}

export function scopeEditHint(
  scopeId: string,
  _scopeTitle: string,
  editContext: CalendarEditContext,
  graph: TripEntityGraph,
): string | null {
  if (isScopeEditable(scopeId, editContext, graph)) return null;
  if (scopeId === graph.mainGroupId) return null;
  return "View only — calendar edits apply to the whole group";
}
