import { eq } from "drizzle-orm";

import { db } from "../src/lib/db/client";
import { costLineItems } from "../src/lib/db/schema";
import { loadTripGraph } from "../src/lib/trip-engine/load-trip-graph";
import { loadCostLedgerProjection } from "../src/lib/trip-engine/cost-ledger/index";
import { financeSectionForLine } from "../src/lib/trip-engine/cost-ledger/finance-sections";

const tripId = process.argv[2] ?? "81f96f12-4b9c-42f2-a32a-443d5ee388c1";

async function main() {
  const lines = await db
    .select()
    .from(costLineItems)
    .where(eq(costLineItems.tripId, tripId))
    .orderBy(costLineItems.sortOrder);

  console.log("tripId:", tripId);
  console.log("Total DB lines:", lines.length);

  const manual = lines.filter(
    (l) => !l.linkedStayId && !l.linkedTransportLegId && !l.linkedActivityId,
  );
  console.log("Manual/unlinked lines:", manual.length);
  for (const l of manual) {
    console.log(
      JSON.stringify({
        id: l.id,
        desc: l.description,
        category: l.category,
        payload: l.allocationRulePayload,
        total: l.totalAmountCents,
        sortOrder: l.sortOrder,
      }),
    );
  }

  const graph = await loadTripGraph(tripId);
  const projection = await loadCostLedgerProjection(tripId, graph);
  console.log("\nProjection line count:", projection.lineItems.length);

  const unsectioned = projection.lineItems.filter(
    (line) => financeSectionForLine(line, graph, projection.settings) == null,
  );
  console.log("Lines with no finance section (hidden from tabs):", unsectioned.length);
  for (const line of unsectioned) {
    console.log(
      JSON.stringify({
        id: line.id,
        desc: line.description,
        category: line.category,
        payload: line.allocationRulePayload,
      }),
    );
  }

  const transportManual = projection.lineItems.filter(
    (line) => financeSectionForLine(line, graph, projection.settings) === "transport",
  );
  console.log("\nTransport section lines:", transportManual.length);
  for (const line of transportManual) {
    if (!line.linkedTransportLegId) {
      console.log(`  manual: ${line.description} (${line.id.slice(0, 8)}…) $${line.totalAmountCents / 100}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
