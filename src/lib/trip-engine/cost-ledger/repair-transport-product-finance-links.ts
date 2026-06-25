import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

type CostLineRow = typeof costLineItems.$inferSelect;

function isUnlinkedTransportLine(line: CostLineRow): boolean {
  return (
    line.category === "transport" &&
    !line.linkedTransportProductId &&
    !line.linkedTransportLegId &&
    !line.linkedStayId &&
    !line.linkedActivityId
  );
}

/**
 * Backfill product links on orphan JR Pass-style rows and delete duplicates left by
 * earlier sync bugs that omitted linkedTransportProductId.
 */
export async function repairTransportProductFinanceLinks(
  tripId: string,
  graph: TripEntityGraph,
): Promise<number> {
  const products = [...(graph.transportProducts ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  if (!products.length) return 0;

  const lines = await db
    .select()
    .from(costLineItems)
    .where(eq(costLineItems.tripId, tripId));

  let changed = 0;
  const linkedProductIds = new Set(
    lines.map((line) => line.linkedTransportProductId).filter(Boolean) as string[],
  );

  const orphansByDescription = new Map<string, CostLineRow[]>();
  for (const line of lines) {
    if (!isUnlinkedTransportLine(line)) continue;
    const key = line.description.trim();
    const bucket = orphansByDescription.get(key) ?? [];
    bucket.push(line);
    orphansByDescription.set(key, bucket);
  }

  for (const product of products) {
    const name = product.name.trim() || "Transport product";
    const orphans = orphansByDescription.get(name) ?? [];
    if (!orphans.length) continue;

    if (linkedProductIds.has(product.id)) {
      for (const orphan of orphans) {
        await db.delete(costLineItems).where(eq(costLineItems.id, orphan.id));
        changed += 1;
      }
      orphansByDescription.delete(name);
      continue;
    }

    const [keep, ...extras] = orphans;
    await db
      .update(costLineItems)
      .set({ linkedTransportProductId: product.id })
      .where(eq(costLineItems.id, keep.id));
    linkedProductIds.add(product.id);
    changed += 1;

    for (const extra of extras) {
      await db.delete(costLineItems).where(eq(costLineItems.id, extra.id));
      changed += 1;
    }
    orphansByDescription.set(name, []);
  }

  for (const orphans of orphansByDescription.values()) {
    for (const orphan of orphans) {
      const productName = orphan.description.trim();
      if (!productName) continue;
      const hasLinkedProduct = products.some(
        (product) =>
          linkedProductIds.has(product.id) &&
          (product.name.trim() || "Transport product") === productName,
      );
      if (!hasLinkedProduct) continue;
      await db.delete(costLineItems).where(eq(costLineItems.id, orphan.id));
      changed += 1;
    }
  }

  return changed;
}
