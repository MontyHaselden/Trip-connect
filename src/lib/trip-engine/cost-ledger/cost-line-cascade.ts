import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import {
  clearFinanceDismissalsForEntity,
  type FinanceDismissedEntityType,
} from "./finance-dismissals";
import { duplicatePersonalStayIdsForFinance } from "./accommodation-finance-leg";

export async function deleteCostLinesForStay(tripId: string, stayId: string): Promise<void> {
  await db
    .delete(costLineItems)
    .where(eq(costLineItems.linkedStayId, stayId));
  await clearFinanceDismissalsForEntity(tripId, "accommodation_stay", stayId);
}

export async function deleteCostLinesForTransportLeg(
  tripId: string,
  legId: string,
): Promise<void> {
  await db
    .delete(costLineItems)
    .where(eq(costLineItems.linkedTransportLegId, legId));
  await clearFinanceDismissalsForEntity(tripId, "transport_leg", legId);
}

export async function deleteCostLinesForTransportProduct(
  tripId: string,
  productId: string,
): Promise<void> {
  await db
    .delete(costLineItems)
    .where(eq(costLineItems.linkedTransportProductId, productId));
  await clearFinanceDismissalsForEntity(tripId, "transport_product", productId);
}

export async function deleteCostLinesForActivity(
  tripId: string,
  activityId: string,
): Promise<void> {
  await db
    .delete(costLineItems)
    .where(eq(costLineItems.linkedActivityId, activityId));
  await clearFinanceDismissalsForEntity(tripId, "itinerary_item", activityId);
}

export async function deleteCostLinesForEntity(
  tripId: string,
  entityType: FinanceDismissedEntityType,
  entityId: string,
): Promise<void> {
  switch (entityType) {
    case "accommodation_stay":
      await deleteCostLinesForStay(tripId, entityId);
      break;
    case "transport_leg":
      await deleteCostLinesForTransportLeg(tripId, entityId);
      break;
    case "itinerary_item":
      await deleteCostLinesForActivity(tripId, entityId);
      break;
  }
}

export async function purgeLocationPlaceholderStayLines(
  tripId: string,
  graph: { accommodationStays: { id: string; name?: string | null }[] },
): Promise<number> {
  const placeholderStayIds = new Set(
    graph.accommodationStays.filter((s) => !s.name?.trim()).map((s) => s.id),
  );
  if (!placeholderStayIds.size) return 0;

  const lines = await db
    .select({ id: costLineItems.id, linkedStayId: costLineItems.linkedStayId })
    .from(costLineItems)
    .where(eq(costLineItems.tripId, tripId));

  const orphanIds = lines
    .filter((line) => line.linkedStayId && placeholderStayIds.has(line.linkedStayId))
    .map((l) => l.id);

  if (!orphanIds.length) return 0;

  for (const id of orphanIds) {
    await db.delete(costLineItems).where(eq(costLineItems.id, id));
  }
  return orphanIds.length;
}

export async function purgeOrphanCostLines(
  tripId: string,
  validStayIds: Set<string>,
  validLegIds: Set<string>,
  validActivityIds: Set<string>,
  validProductIds: Set<string> = new Set(),
): Promise<number> {
  const lines = await db
    .select()
    .from(costLineItems)
    .where(eq(costLineItems.tripId, tripId));

  const orphanIds = lines
    .filter((line) => {
      if (line.linkedStayId && !validStayIds.has(line.linkedStayId)) return true;
      if (line.linkedTransportLegId && !validLegIds.has(line.linkedTransportLegId)) return true;
      if (line.linkedActivityId && !validActivityIds.has(line.linkedActivityId)) return true;
      if (line.linkedTransportProductId && !validProductIds.has(line.linkedTransportProductId)) {
        return true;
      }
      return false;
    })
    .map((l) => l.id);

  if (!orphanIds.length) return 0;

  for (const id of orphanIds) {
    await db.delete(costLineItems).where(eq(costLineItems.id, id));
  }
  return orphanIds.length;
}

/** Remove finance rows for personal stays that duplicate a main-group hotel leg. */
export async function purgeDuplicatePersonalStayFinanceLines(
  tripId: string,
  graph: TripEntityGraph,
): Promise<number> {
  const duplicateStayIds = duplicatePersonalStayIdsForFinance(graph);
  if (!duplicateStayIds.size) return 0;

  const lines = await db
    .select({ id: costLineItems.id, linkedStayId: costLineItems.linkedStayId })
    .from(costLineItems)
    .where(eq(costLineItems.tripId, tripId));

  const orphanIds = lines
    .filter((line) => line.linkedStayId && duplicateStayIds.has(line.linkedStayId))
    .map((l) => l.id);

  if (!orphanIds.length) return 0;

  for (const id of orphanIds) {
    await db.delete(costLineItems).where(eq(costLineItems.id, id));
  }
  return orphanIds.length;
}

export function graphEntityIdSets(graph: {
  accommodationStays: { id: string; name?: string | null }[];
  outboundLegs: { id: string }[];
  returnLegs: { id: string }[];
  intercityLegs: { id: string }[];
  activities: { id: string }[];
  transportProducts?: { id: string }[];
}) {
  return {
    stayIds: new Set(
      graph.accommodationStays.filter((s) => Boolean(s.name?.trim())).map((s) => s.id),
    ),
    legIds: new Set([
      ...graph.outboundLegs.map((l) => l.id),
      ...graph.returnLegs.map((l) => l.id),
      ...graph.intercityLegs.map((l) => l.id),
    ]),
    activityIds: new Set(graph.activities.map((a) => a.id)),
    productIds: new Set((graph.transportProducts ?? []).map((product) => product.id)),
  };
}
