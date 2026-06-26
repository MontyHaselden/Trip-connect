/**
 * Delete group_day_places rows outside the trip calendar grid.
 *
 * Usage:
 *   TRIP_ID=0badae43-... npx tsx scripts/prune-off-grid-day-places.ts
 *   DRY_RUN=1 TRIP_ID=... npx tsx scripts/prune-off-grid-day-places.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, sql } from "drizzle-orm";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required (.env.local or environment).");
  }

  const tripId =
    process.env.TRIP_ID ?? "0badae43-50ff-49ec-ad88-abd62e2d5ad3";
  const dryRun = process.env.DRY_RUN === "1";

  const { db } = await import("@/lib/db/client");
  const { groupDayPlaces, trips } = await import("@/lib/db/schema");
  const { gridBoundsForTripLoad } = await import(
    "@/lib/trip-engine/grid-bounds-for-load"
  );

  const trip = await db
    .select({
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      name: trips.name,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) throw new Error(`Trip not found: ${tripId}`);

  const { gridStart, gridEnd } = gridBoundsForTripLoad(trip);
  console.log(`Trip: ${trip.name} (${tripId})`);
  console.log(`Grid: ${gridStart} → ${gridEnd}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "DELETE"}`);

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupDayPlaces)
    .where(eq(groupDayPlaces.tripId, tripId));

  const [{ count: offGrid }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groupDayPlaces)
    .where(
      and(
        eq(groupDayPlaces.tripId, tripId),
        sql`(${groupDayPlaces.date} < ${gridStart} OR ${groupDayPlaces.date} > ${gridEnd})`,
      ),
    );

  console.log(`Total day-place rows: ${total}`);
  console.log(`Off-grid rows to remove: ${offGrid}`);

  if (!offGrid || dryRun) return;

  const deleted = await db
    .delete(groupDayPlaces)
    .where(
      and(
        eq(groupDayPlaces.tripId, tripId),
        sql`(${groupDayPlaces.date} < ${gridStart} OR ${groupDayPlaces.date} > ${gridEnd})`,
      ),
    )
    .returning({ id: groupDayPlaces.id });

  console.log(`Deleted ${deleted.length} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
