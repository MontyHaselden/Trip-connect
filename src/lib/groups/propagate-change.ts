import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groupOverlayOps,
  itineraryItems,
  tripAccommodationStays,
  tripTransportLegs,
} from "@/lib/db/schema";

export type PropagateScope = "main_only" | "all_groups" | "selected_groups";

export type PropagatePatch = Record<string, string | null>;

const ENTITY_TABLES = {
  itinerary_item: itineraryItems,
  transport_leg: tripTransportLegs,
  accommodation_stay: tripAccommodationStays,
} as const;

export async function findLinkedEntities(
  entityType: keyof typeof ENTITY_TABLES,
  baseEntityId: string,
): Promise<Array<{ id: string; originGroupId: string | null }>> {
  const table = ENTITY_TABLES[entityType];
  const rows = await db
    .select({ id: table.id, originGroupId: table.originGroupId })
    .from(table)
    .where(eq(table.sourceEntityId, baseEntityId));
  return rows;
}

export async function groupsWithOverrideOnBase(
  tripId: string,
  entityType: "itinerary_item" | "transport_leg" | "accommodation_stay" | "trip_day",
  baseEntityId: string,
): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupOverlayOps.groupId })
    .from(groupOverlayOps)
    .where(
      and(
        eq(groupOverlayOps.tripId, tripId),
        eq(groupOverlayOps.entityType, entityType),
        eq(groupOverlayOps.baseEntityId, baseEntityId),
      ),
    );
  return [...new Set(rows.map((r) => r.groupId))];
}

export async function propagateEntityChange(params: {
  tripId: string;
  entityType: keyof typeof ENTITY_TABLES;
  baseEntityId: string;
  patch: PropagatePatch;
  scope: PropagateScope;
  selectedGroupIds?: string[];
}): Promise<{ updatedIds: string[] }> {
  const { entityType, baseEntityId, patch, scope } = params;
  const table = ENTITY_TABLES[entityType];
  const updatedIds: string[] = [];

  await db.update(table).set(patch).where(eq(table.id, baseEntityId));
  updatedIds.push(baseEntityId);

  if (scope === "main_only") return { updatedIds };

  const linked = await findLinkedEntities(entityType, baseEntityId);
  const overriddenGroups = new Set(
    await groupsWithOverrideOnBase(params.tripId, entityType, baseEntityId),
  );

  let targetLinked = linked.filter((l) => !overriddenGroups.has(l.originGroupId ?? ""));

  if (scope === "selected_groups" && params.selectedGroupIds?.length) {
    const selected = new Set(params.selectedGroupIds);
    targetLinked = targetLinked.filter((l) => l.originGroupId && selected.has(l.originGroupId));
  }

  if (targetLinked.length) {
    const ids = targetLinked.map((l) => l.id);
    await db.update(table).set(patch).where(inArray(table.id, ids));
    updatedIds.push(...ids);
  }

  return { updatedIds };
}
