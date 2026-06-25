import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "../src/lib/db/client";
import { costLineItems } from "../src/lib/db/schema";

const tripId = process.argv[2] ?? "81f96f12-4b9c-42f2-a32a-443d5ee388c1";

async function main() {
  const orphans = await db
    .select()
    .from(costLineItems)
    .where(
      and(
        eq(costLineItems.tripId, tripId),
        isNull(costLineItems.linkedStayId),
        isNull(costLineItems.linkedTransportLegId),
        isNull(costLineItems.linkedActivityId),
        sql`${costLineItems.allocationRulePayload} = '{}'::jsonb`,
        sql`${costLineItems.description} ~* 'insurance'`,
      ),
    );

  console.log(`Repairing ${orphans.length} orphan insurance line(s) on trip ${tripId}`);
  for (const line of orphans) {
    await db
      .update(costLineItems)
      .set({
        allocationRulePayload: { financeSection: "transport" },
        updatedAt: new Date(),
      })
      .where(eq(costLineItems.id, line.id));
    console.log(`  fixed ${line.id.slice(0, 8)}… ${line.description}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
