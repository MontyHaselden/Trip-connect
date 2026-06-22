import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";

import {
  clearFinanceDismissalsForEntity,
  type FinanceDismissedEntityType,
} from "./finance-dismissals";

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

export async function purgeOrphanCostLines(
  tripId: string,
  validStayIds: Set<string>,
  validLegIds: Set<string>,
  validActivityIds: Set<string>,
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
      return false;
    })
    .map((l) => l.id);

  if (!orphanIds.length) return 0;

  for (const id of orphanIds) {
    await db.delete(costLineItems).where(eq(costLineItems.id, id));
  }
  return orphanIds.length;
}

export function graphEntityIdSets(graph: {
  accommodationStays: { id: string }[];
  outboundLegs: { id: string }[];
  returnLegs: { id: string }[];
  intercityLegs: { id: string }[];
  activities: { id: string }[];
}) {
  return {
    stayIds: new Set(graph.accommodationStays.map((s) => s.id)),
    legIds: new Set([
      ...graph.outboundLegs.map((l) => l.id),
      ...graph.returnLegs.map((l) => l.id),
      ...graph.intercityLegs.map((l) => l.id),
    ]),
    activityIds: new Set(graph.activities.map((a) => a.id)),
  };
}
