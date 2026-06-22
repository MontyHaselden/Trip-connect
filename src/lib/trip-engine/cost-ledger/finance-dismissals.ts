import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripFinanceDismissals } from "@/lib/db/schema";

export type FinanceDismissedEntityType =
  | "accommodation_stay"
  | "transport_leg"
  | "itinerary_item";

export type FinanceDismissalKey = {
  entityType: FinanceDismissedEntityType;
  entityId: string;
};

export function dismissalKeyFromLine(line: {
  linkedStayId?: string | null;
  linkedTransportLegId?: string | null;
  linkedActivityId?: string | null;
}): FinanceDismissalKey | null {
  if (line.linkedStayId) {
    return { entityType: "accommodation_stay", entityId: line.linkedStayId };
  }
  if (line.linkedTransportLegId) {
    return { entityType: "transport_leg", entityId: line.linkedTransportLegId };
  }
  if (line.linkedActivityId) {
    return { entityType: "itinerary_item", entityId: line.linkedActivityId };
  }
  return null;
}

export async function loadFinanceDismissals(tripId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      entityType: tripFinanceDismissals.entityType,
      entityId: tripFinanceDismissals.entityId,
    })
    .from(tripFinanceDismissals)
    .where(eq(tripFinanceDismissals.tripId, tripId));

  return new Set(rows.map((r) => `${r.entityType}:${r.entityId}`));
}

export function isDismissed(
  dismissals: Set<string>,
  entityType: FinanceDismissedEntityType,
  entityId: string,
): boolean {
  return dismissals.has(`${entityType}:${entityId}`);
}

export async function dismissFromFinance(
  tripId: string,
  key: FinanceDismissalKey,
): Promise<void> {
  await db
    .insert(tripFinanceDismissals)
    .values({
      tripId,
      entityType: key.entityType,
      entityId: key.entityId,
    })
    .onConflictDoNothing();
}

export async function clearFinanceDismissal(
  tripId: string,
  key: FinanceDismissalKey,
): Promise<void> {
  await db
    .delete(tripFinanceDismissals)
    .where(
      and(
        eq(tripFinanceDismissals.tripId, tripId),
        eq(tripFinanceDismissals.entityType, key.entityType),
        eq(tripFinanceDismissals.entityId, key.entityId),
      ),
    );
}

export async function clearFinanceDismissalsForEntity(
  tripId: string,
  entityType: FinanceDismissedEntityType,
  entityId: string,
): Promise<void> {
  await clearFinanceDismissal(tripId, { entityType, entityId });
}
