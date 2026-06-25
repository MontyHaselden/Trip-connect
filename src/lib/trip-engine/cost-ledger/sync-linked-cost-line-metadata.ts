import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { loadCostLedgerRaw } from "./load-cost-ledger";
import { countStayNights } from "./accommodation-nights";
import { productLegRoutesSummary } from "./transport-finance-product";
import { transportLegFinanceDescription } from "../transport-route-label";

/** Keep finance row labels in sync when linked trip entities change. */
export async function syncLinkedCostLineMetadata(
  tripId: string,
  graph: TripEntityGraph,
): Promise<number> {
  const raw = await loadCostLedgerRaw(tripId);
  let updates = 0;

  for (const stay of graph.accommodationStays) {
    if (!stay.name?.trim()) continue;
    const line = raw.lineItems.find((l) => l.linkedStayId === stay.id);
    if (!line) continue;

    const description = `${stay.name.trim()} (${stay.cityLabel})`;
    const notes = `${stay.checkInDate} → ${stay.checkOutDate}`;
    const quantity = countStayNights(stay.checkInDate, stay.checkOutDate) || null;
    const quantityStr = quantity != null ? String(quantity) : null;
    const lineQuantity = line.quantity;
    const needsQuantity =
      quantity != null && (lineQuantity == null || lineQuantity !== quantity);
    if (
      line.description !== description ||
      line.notes !== notes ||
      needsQuantity
    ) {
      await db
        .update(costLineItems)
        .set({
          description,
          notes,
          ...(needsQuantity ? { quantity: quantityStr } : {}),
          updatedAt: new Date(),
        })
        .where(eq(costLineItems.id, line.id));
      updates++;
    }
  }

  const transportLegs = [
    ...graph.outboundLegs,
    ...graph.returnLegs,
    ...graph.intercityLegs,
  ];
  for (const leg of transportLegs) {
    const line = raw.lineItems.find((l) => l.linkedTransportLegId === leg.id);
    if (!line) continue;

    const description = transportLegFinanceDescription(leg, graph);
    if (line.description !== description) {
      await db
        .update(costLineItems)
        .set({ description, updatedAt: new Date() })
        .where(eq(costLineItems.id, line.id));
      updates++;
    }
  }

  for (const product of graph.transportProducts ?? []) {
    const line = raw.lineItems.find((l) => l.linkedTransportProductId === product.id);
    if (!line) continue;
    const description = product.name.trim() || "Transport product";
    const notes = productLegRoutesSummary(graph, product.id) || product.notes?.trim() || null;
    if (line.description !== description || line.notes !== notes) {
      await db
        .update(costLineItems)
        .set({ description, notes, updatedAt: new Date() })
        .where(eq(costLineItems.id, line.id));
      updates++;
    }
  }

  for (const activity of graph.activities) {
    if (!activity.title?.trim()) continue;
    const line = raw.lineItems.find((l) => l.linkedActivityId === activity.id);
    if (!line) continue;

    const description = activity.title.trim();
    const notes = activity.date;
    if (line.description !== description || line.notes !== notes) {
      await db
        .update(costLineItems)
        .set({ description, notes, updatedAt: new Date() })
        .where(eq(costLineItems.id, line.id));
      updates++;
    }
  }

  return updates;
}
