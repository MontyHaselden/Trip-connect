import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { loadCostLedgerRaw } from "./load-cost-ledger";
import { buildSeedLineItems, seedItemsNotYetPresent } from "./seed-from-graph";

/** Insert placeholder cost rows for trip entities not yet in the ledger. Idempotent. */
export async function syncCostLedgerFromGraph(
  tripId: string,
  graph: TripEntityGraph,
): Promise<number> {
  const raw = await loadCostLedgerRaw(tripId);
  const seeds = seedItemsNotYetPresent(raw.lineItems, buildSeedLineItems(graph));
  if (!seeds.length) return 0;

  await db.insert(costLineItems).values(
    seeds.map((seed, index) => ({
      tripId,
      sortOrder: raw.lineItems.length + index,
      category: seed.category,
      description: seed.description,
      notes: seed.notes,
      totalAmountCents: seed.totalAmountCents,
      currency: seed.currency,
      quantity: seed.quantity != null ? String(seed.quantity) : null,
      allocationRuleType: seed.allocationRuleType,
      allocationRulePayload: seed.allocationRulePayload,
      linkedStayId: seed.linkedStayId,
      linkedTransportLegId: seed.linkedTransportLegId,
      linkedActivityId: seed.linkedActivityId,
      supplierPaymentStatus: seed.supplierPaymentStatus,
    })),
  );

  return seeds.length;
}
