import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { loadCostLedgerRaw } from "./load-cost-ledger";
import { purgeLocationPlaceholderStayLines, purgeOrphanCostLines, purgeDuplicatePersonalStayFinanceLines, purgeDuplicatePersonalTransportFinanceLines, purgeStaleTransportLegFinanceLines, purgeDuplicateActivityFinanceLines, graphEntityIdSets } from "./cost-line-cascade";
import { normalizeGraphActivities } from "../merge-graph-activities";
import { repairTransportProductFinanceLinks } from "./repair-transport-product-finance-links";
import { buildSeedLineItems, seedItemsNotYetPresent } from "./seed-from-graph";
import { syncLinkedCostLineMetadata } from "./sync-linked-cost-line-metadata";

/** Insert placeholder cost rows for trip entities not yet in the ledger. Idempotent. */
export async function syncCostLedgerFromGraph(
  tripId: string,
  graph: TripEntityGraph,
  dismissedKeys: Set<string> = new Set(),
): Promise<number> {
  const normalizedGraph: TripEntityGraph = {
    ...graph,
    activities: normalizeGraphActivities(graph.activities),
  };

  await purgeLocationPlaceholderStayLines(tripId, normalizedGraph);
  await purgeDuplicatePersonalStayFinanceLines(tripId, normalizedGraph);
  await purgeDuplicatePersonalTransportFinanceLines(tripId, normalizedGraph);
  await purgeStaleTransportLegFinanceLines(tripId, normalizedGraph);
  await purgeDuplicateActivityFinanceLines(tripId, normalizedGraph);
  await repairTransportProductFinanceLinks(tripId, normalizedGraph);
  const entityIds = graphEntityIdSets(normalizedGraph);
  await purgeOrphanCostLines(
    tripId,
    entityIds.stayIds,
    entityIds.legIds,
    entityIds.activityIds,
    entityIds.productIds,
  );
  await syncLinkedCostLineMetadata(tripId, normalizedGraph);
  const raw = await loadCostLedgerRaw(tripId);
  const seeds = seedItemsNotYetPresent(
    raw.lineItems,
    buildSeedLineItems(normalizedGraph),
    dismissedKeys,
  );
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
      linkedTransportProductId: seed.linkedTransportProductId,
      linkedActivityId: seed.linkedActivityId,
      scope: seed.scope,
      supplierPaymentStatus: seed.supplierPaymentStatus,
      costStatus: seed.costStatus,
      linePaymentStatus: seed.linePaymentStatus,
      fundingStatus: seed.fundingStatus,
      supplierName: seed.supplierName,
      estimatedAmountCents: seed.estimatedAmountCents,
      actualAmountCents: seed.actualAmountCents,
      taxTreatment: seed.taxTreatment,
      exportCategoryLabel: seed.exportCategoryLabel,
      exportReference: seed.exportReference,
      bookingReference: seed.bookingReference,
      invoiceRecorded: seed.invoiceRecorded,
      receiptRecorded: seed.receiptRecorded,
    })),
  );

  return seeds.length;
}
