import type { ActivityDraft } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

/** Stable identity for duplicate activity detection (same outing on same day). */
export function activityContentKey(activity: ActivityDraft): string {
  return [
    activity.date,
    activity.title.trim().toLowerCase(),
    activity.originGroupId ?? "",
  ].join("|");
}

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

/** One calendar activity per title/day/scope — keeps lowest id as canonical. */
export function normalizeGraphActivities(activities: ActivityDraft[]): ActivityDraft[] {
  const byId = mergeActivitiesById(activities);
  const byContent = new Map<string, ActivityDraft>();
  for (const activity of byId) {
    const key = activityContentKey(activity);
    const existing = byContent.get(key);
    if (!existing || activity.id.localeCompare(existing.id) < 0) {
      byContent.set(key, activity);
    }
  }
  return [...byContent.values()];
}

/** Map duplicate activity ids onto the canonical row kept by {@link normalizeGraphActivities}. */
export function duplicateActivityIdsForFinance(
  activities: ActivityDraft[],
): Map<string, string> {
  const canonicalByKey = new Map<string, ActivityDraft>();
  const remap = new Map<string, string>();

  for (const activity of mergeActivitiesById(activities)) {
    const key = activityContentKey(activity);
    const existing = canonicalByKey.get(key);
    if (!existing) {
      canonicalByKey.set(key, activity);
      continue;
    }
    const canonical =
      activity.id.localeCompare(existing.id) < 0 ? activity : existing;
    const duplicate = canonical.id === activity.id ? existing : activity;
    canonicalByKey.set(key, canonical);
    if (duplicate.id !== canonical.id) {
      remap.set(duplicate.id, canonical.id);
    }
  }

  return remap;
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
