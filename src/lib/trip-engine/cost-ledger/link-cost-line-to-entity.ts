import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";

import { loadCostLedgerRaw } from "./load-cost-ledger";

/** Attach a manual finance row to a calendar activity (avoids duplicate seeded rows). */
export async function linkCostLineToActivity(
  tripId: string,
  lineId: string,
  activityId: string,
  activityDate: string,
): Promise<boolean> {
  const raw = await loadCostLedgerRaw(tripId);
  const line = raw.lineItems.find((row) => row.id === lineId);
  if (!line || line.linkedActivityId) return false;

  const nextPayload = { ...line.allocationRulePayload };
  delete nextPayload.financeSection;

  await db
    .update(costLineItems)
    .set({
      linkedActivityId: activityId,
      linkedStayId: null,
      linkedTransportLegId: null,
      category: "activities",
      notes: activityDate,
      allocationRuleType: "equal_present",
      allocationRulePayload: nextPayload,
      scope: "presence",
      updatedAt: new Date(),
    })
    .where(and(eq(costLineItems.id, lineId), eq(costLineItems.tripId, tripId)));

  return true;
}
