import { eq } from "drizzle-orm";
import { z } from "zod";

import { patchBulkParticipantAllocations } from "../src/components/trip-os/finance/finance-line-patch";
import { db } from "../src/lib/db/client";
import { costAllocationOverrides, costLineItems } from "../src/lib/db/schema";
import { loadCostLedgerProjection } from "../src/lib/trip-engine/cost-ledger/index";
import { loadTripGraph } from "../src/lib/trip-engine/load-trip-graph";
import { loadRosterSummary } from "../src/lib/trip-engine/roster-summary";

const LineItemSchema = z
  .object({
    totalAmountCents: z.number().int().min(0),
    overrides: z
      .array(
        z.object({
          participantId: z.string().uuid(),
          amountCents: z.number().int(),
        }),
      )
      .optional(),
  })
  .partial();

async function main() {
  const tripId = process.argv[2] ?? "81f96f12-4b9c-42f2-a32a-443d5ee388c1";
  const graph = await loadTripGraph(tripId);
  if (!graph) throw new Error("no graph");
  const roster = await loadRosterSummary(tripId);
  const ledger = await loadCostLedgerProjection(tripId, graph);
  const line = ledger.lineItems.find((l) => l.description.includes("Christchurch"));
  const lineAlloc = ledger.lineAllocations.find((l) => l.lineItemId === line?.id);
  if (!line || !lineAlloc) throw new Error("no line");

  const pool = roster.participants.filter((p) => p.inCostSplit).slice(0, 19);
  const amountCents = 104750;
  const patch = patchBulkParticipantAllocations(
    line,
    lineAlloc,
    pool.map((p) => ({ participantId: p.id, amountCents })),
  );
  const parsed = LineItemSchema.safeParse(patch);
  console.log("zod ok", parsed.success);
  if (!parsed.success) console.log(parsed.error.issues);
  for (const o of patch.overrides as { participantId: string; amountCents: number }[]) {
    if (!Number.isInteger(o.amountCents)) console.log("non-int amount", o);
  }
  console.log("total", patch.totalAmountCents, Number.isInteger(patch.totalAmountCents));

  try {
    await db
      .update(costLineItems)
      .set({ totalAmountCents: patch.totalAmountCents as number, updatedAt: new Date() })
      .where(eq(costLineItems.id, line.id));
    await db
      .delete(costAllocationOverrides)
      .where(eq(costAllocationOverrides.lineItemId, line.id));
    if ((patch.overrides as { participantId: string; amountCents: number }[]).length) {
      await db.insert(costAllocationOverrides).values(
        (patch.overrides as { participantId: string; amountCents: number }[]).map((o) => ({
          lineItemId: line.id,
          participantId: o.participantId,
          amountCents: o.amountCents,
        })),
      );
    }
    console.log("db ok");
  } catch (e) {
    console.error("db err", e);
  }
}

void main();
