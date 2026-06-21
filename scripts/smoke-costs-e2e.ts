/**
 * End-to-end smoke test: seed roster + cost line + fund + payment, verify projection.
 * Usage: node --env-file=.env.local node_modules/.bin/tsx scripts/smoke-costs-e2e.ts
 */
import { desc, eq } from "drizzle-orm";

import { db } from "../src/lib/db/client";
import {
  costLineItems,
  participantPayments,
  participants,
  tripFunds,
  trips,
} from "../src/lib/db/schema";
import { loadCostLedgerProjection } from "../src/lib/trip-engine/cost-ledger/index";
import { loadRosterSummary } from "../src/lib/trip-engine/roster-summary";
import { generatePlaceholderPhone } from "../src/lib/participants/roster-phone";
import { generateAccessToken } from "../src/lib/utils/tokens";

async function main() {
  const [trip] = await db
    .select({ id: trips.id, name: trips.name })
    .from(trips)
    .orderBy(desc(trips.updatedAt))
    .limit(1);

  if (!trip) throw new Error("No trip found");

  console.log(`Using trip: ${trip.name}`);

  // Ensure 3 test participants
  const existing = await db
    .select({ id: participants.id })
    .from(participants)
    .where(eq(participants.tripId, trip.id))
    .limit(3);

  if (existing.length < 3) {
    for (let i = existing.length; i < 3; i++) {
      await db.insert(participants).values({
        tripId: trip.id,
        fullName: `Smoke Student ${i + 1}`,
        phoneNumberE164: generatePlaceholderPhone(),
        role: "student",
        inCostSplit: true,
        accessToken: generateAccessToken(),
      });
    }
    console.log("Added test participants");
  }

  const roster = await loadRosterSummary(trip.id);
  const pool = roster.participants.filter((p) => p.inCostSplit && p.role !== "host");
  if (pool.length < 2) throw new Error("Need at least 2 cost-split participants");

  const raw = await loadCostLedgerProjection(trip.id);
  if (!raw.lineItems.length) {
    await db.insert(costLineItems).values({
      tripId: trip.id,
      sortOrder: 0,
      category: "accommodation",
      description: "Smoke test hotel",
      totalAmountCents: 120_000,
      currency: "NZD",
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: {},
    });
    console.log("Added cost line ($1,200 ÷ participants)");
  }

  if (!raw.funds.length) {
    await db.insert(tripFunds).values({
      tripId: trip.id,
      sortOrder: 0,
      name: "Smoke council grant",
      amountCents: 15_000,
      currency: "NZD",
      allocationRuleType: "equal_cost_participants",
      allocationRulePayload: {},
    });
    console.log("Added trip fund ($150 grant)");
  }

  if (!raw.payments.length) {
    await db.insert(participantPayments).values({
      tripId: trip.id,
      participantId: pool[0].id,
      amountCents: 33_000,
      currency: "NZD",
      paidAt: "2026-01-01",
      label: "deposit",
    });
    console.log(`Added payment for ${pool[0].fullName}`);
  }

  const ledger = await loadCostLedgerProjection(trip.id);
  const first = ledger.personBalances.find((b) => b.participantId === pool[0].id);
  if (!first) throw new Error("Missing person balance");

  console.log("\n--- Balances ---");
  for (const p of pool) {
    const bal = ledger.personBalances.find((b) => b.participantId === p.id);
    if (!bal) continue;
    console.log(
      `${p.fullName}: gross $${(bal.grossCents / 100).toFixed(2)} − funds $${(bal.fundCreditsCents / 100).toFixed(2)} − paid $${(bal.paidCents / 100).toFixed(2)} = balance $${(bal.balanceCents / 100).toFixed(2)}`,
    );
  }

  const balanced = ledger.lineAllocations.every((l) => l.balanced);
  if (!balanced) throw new Error("Unbalanced line allocations");

  console.log("\nAll line allocations balanced ✓");
  console.log(`Trip outstanding: $${(ledger.tripOutstandingCents / 100).toFixed(2)}`);
  console.log("E2E smoke test passed");
}

main().catch((err) => {
  console.error("E2E smoke test failed:", err);
  process.exit(1);
});
