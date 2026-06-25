import type { ActivityDraft } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

/** Union activities by id — later entries win (client overrides server for same id). */
export function mergeActivitiesById(
  ...lists: Array<ActivityDraft[] | undefined | null>
): ActivityDraft[] {
  const byId = new Map<string, ActivityDraft>();
  for (const list of lists) {
    if (!list) continue;
    for (const activity of list) {
      if (!activity.id?.trim()) continue;
      byId.set(activity.id, activity);
    }
  }
  return [...byId.values()];
}

/** Prefer the host's live calendar when it has activities the DB snapshot missed. */
export function mergeClientActivitiesIntoGraph(
  serverGraph: TripEntityGraph,
  clientActivities?: ActivityDraft[] | null,
): TripEntityGraph {
  if (!clientActivities?.length) return serverGraph;
  return {
    ...serverGraph,
    activities: mergeActivitiesById(serverGraph.activities, clientActivities),
  };
}
