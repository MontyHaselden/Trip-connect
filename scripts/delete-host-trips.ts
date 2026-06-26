/**
 * Delete trips for a host account (cascade). Keeps one trip if KEEP_TRIP_ID is set.
 *
 * Usage:
 *   KEEP_TRIP_ID=51db4502-f2c5-473c-a69a-bc83ba329b4c npx tsx scripts/delete-host-trips.ts
 *   HOST_EMAIL=you@school.nz npx tsx scripts/delete-host-trips.ts
 *   DRY_RUN=1 KEEP_TRIP_ID=... npx tsx scripts/delete-host-trips.ts
 *   DELETE_ALL_NEW_TRIPS=1 HOST_EMAIL=... npx tsx scripts/delete-host-trips.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { and, eq, ne } from "drizzle-orm";

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

  const dryRun = process.env.DRY_RUN === "1";
  const keepTripId = process.env.KEEP_TRIP_ID?.trim() || null;
  const hostEmail = process.env.HOST_EMAIL?.trim().toLowerCase() || null;
  const onlyNewTrips = process.env.DELETE_ALL_NEW_TRIPS === "1";

  const { db } = await import("../src/lib/db/client");
  const { hostAccounts, hostTripMembers, trips } = await import("../src/lib/db/schema");

  let hostId = process.env.HOST_ID?.trim() || null;
  if (!hostId && hostEmail) {
    const row = await db
      .select({ id: hostAccounts.id, email: hostAccounts.email })
      .from(hostAccounts)
      .where(eq(hostAccounts.email, hostEmail))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!row) throw new Error(`No host account for email: ${hostEmail}`);
    hostId = row.id;
    console.log(`Host: ${row.email} (${hostId})`);
  }

  if (!hostId) {
    throw new Error("Set HOST_ID or HOST_EMAIL to identify the account.");
  }

  const rows = await db
    .select({
      id: trips.id,
      name: trips.name,
      inviteCode: trips.inviteCode,
      startDate: trips.startDate,
      endDate: trips.endDate,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(eq(hostTripMembers.hostId, hostId));

  const targets = rows.filter((trip) => {
    if (keepTripId && trip.id === keepTripId) return false;
    if (onlyNewTrips && trip.name.trim() !== "New trip") return false;
    if (!keepTripId && !onlyNewTrips) return true;
    return true;
  });

  if (!targets.length) {
    console.log("Nothing to delete.");
    return;
  }

  console.log(`\nWill delete ${targets.length} trip(s)${keepTripId ? ` (keeping ${keepTripId})` : ""}:\n`);
  for (const trip of targets) {
    console.log(
      `  - ${trip.name} (${trip.id}) invite ${trip.inviteCode} ${trip.startDate} → ${trip.endDate}`,
    );
  }

  if (dryRun) {
    console.log("\nDRY_RUN=1 — no rows deleted.");
    return;
  }

  for (const trip of targets) {
    await db.delete(trips).where(eq(trips.id, trip.id));
    console.log(`Deleted ${trip.id}`);
  }

  console.log(`\nDone. Deleted ${targets.length} trip(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
