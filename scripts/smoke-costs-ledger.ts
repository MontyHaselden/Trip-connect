import { desc } from "drizzle-orm";

import { db } from "../src/lib/db/client";
import { trips } from "../src/lib/db/schema";
import { loadCostLedgerProjection } from "../src/lib/trip-engine/cost-ledger/index";
import { loadRosterSummary } from "../src/lib/trip-engine/roster-summary";

async function main() {
  const [trip] = await db
    .select({ id: trips.id, name: trips.name, inviteCode: trips.inviteCode })
    .from(trips)
    .orderBy(desc(trips.updatedAt))
    .limit(1);

  if (!trip) {
    console.error("No trips in DB — create one or run npm run seed:japan");
    process.exit(1);
  }

  console.log(`Trip: ${trip.name} (${trip.id})`);
  console.log(`Invite: ${trip.inviteCode}`);
  console.log(`Trip OS: http://localhost:3000/dashboard/trips/${trip.id}`);

  const roster = await loadRosterSummary(trip.id);
  console.log(
    `Roster: ${roster.participants.length} participants, ${roster.groups.length} groups, ${roster.rooms.length} rooms`,
  );

  const inSplit = roster.participants.filter((p) => p.inCostSplit).length;
  console.log(`Cost-split participants: ${inSplit}`);

  const ledger = await loadCostLedgerProjection(trip.id);
  console.log(
    `Ledger: ${ledger.lineItems.length} lines, ${ledger.funds.length} funds, ${ledger.payments.length} payments`,
  );
  console.log(
    `Settings: base=${ledger.settings.baseCurrency}, foreign=${ledger.settings.foreignCurrency ?? "—"}, rate=${ledger.settings.exchangeRate ?? "—"}`,
  );
  console.log(`Trip gross (base): ${(ledger.tripGrossCents / 100).toFixed(2)} ${ledger.settings.baseCurrency}`);
  console.log("OK — costs stack loads against live DB");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
