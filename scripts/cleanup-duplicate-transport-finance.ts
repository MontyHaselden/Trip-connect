/**
 * Remove duplicate JR Pass / transport product finance rows left by the
 * linkedTransportProductId seeding bug.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-transport-finance.ts
 *   TRIP_ID=<uuid> npx tsx scripts/cleanup-duplicate-transport-finance.ts
 *   DRY_RUN=1 npx tsx scripts/cleanup-duplicate-transport-finance.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { eq, ilike, sql } from "drizzle-orm";

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
  const tripIdFilter = process.env.TRIP_ID?.trim() || null;

  const { db } = await import("../src/lib/db/client");
  const { costLineItems, trips } = await import("../src/lib/db/schema");
  const { loadTripGraph } = await import("../src/lib/trip-engine/load-trip-graph");
  const { repairTransportProductFinanceLinks } = await import(
    "../src/lib/trip-engine/cost-ledger/repair-transport-product-finance-links"
  );

  type LineRow = typeof costLineItems.$inferSelect;

  function isOrphanTransportLine(line: LineRow): boolean {
    return (
      line.category === "transport" &&
      !line.linkedTransportProductId &&
      !line.linkedTransportLegId &&
      !line.linkedStayId &&
      !line.linkedActivityId
    );
  }

  async function countJrPassLines(tripId: string): Promise<number> {
    const rows = await db
      .select({ id: costLineItems.id })
      .from(costLineItems)
      .where(
        sql`${costLineItems.tripId} = ${tripId} AND ${costLineItems.category} = 'transport' AND trim(${costLineItems.description}) ILIKE 'JR Pass'`,
      );
    return rows.length;
  }

  async function purgeDuplicateLinkedLegLines(tripId: string): Promise<number> {
    const lines = await db
      .select()
      .from(costLineItems)
      .where(eq(costLineItems.tripId, tripId));

    const byLeg = new Map<string, LineRow[]>();
    for (const line of lines) {
      if (!line.linkedTransportLegId) continue;
      const bucket = byLeg.get(line.linkedTransportLegId) ?? [];
      bucket.push(line);
      byLeg.set(line.linkedTransportLegId, bucket);
    }

    let deleted = 0;
    for (const group of byLeg.values()) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
      );
      for (const extra of sorted.slice(1)) {
        if (dryRun) {
          console.log(`  [dry-run] delete linked leg duplicate ${extra.id}`);
        } else {
          await db.delete(costLineItems).where(eq(costLineItems.id, extra.id));
        }
        deleted += 1;
      }
    }
    return deleted;
  }

  async function purgeDuplicateLinkedProductLines(tripId: string): Promise<number> {
    const lines = await db
      .select()
      .from(costLineItems)
      .where(eq(costLineItems.tripId, tripId));

    const byProduct = new Map<string, LineRow[]>();
    for (const line of lines) {
      if (!line.linkedTransportProductId) continue;
      const bucket = byProduct.get(line.linkedTransportProductId) ?? [];
      bucket.push(line);
      byProduct.set(line.linkedTransportProductId, bucket);
    }

    let deleted = 0;
    for (const group of byProduct.values()) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
      );
      for (const extra of sorted.slice(1)) {
        if (dryRun) {
          console.log(`  [dry-run] delete linked duplicate line ${extra.id}`);
        } else {
          await db.delete(costLineItems).where(eq(costLineItems.id, extra.id));
        }
        deleted += 1;
      }
    }
    return deleted;
  }

  async function purgeOrphanTransportDuplicates(tripId: string): Promise<number> {
    const lines = await db
      .select()
      .from(costLineItems)
      .where(eq(costLineItems.tripId, tripId));

    const orphansByDescription = new Map<string, LineRow[]>();
    for (const line of lines) {
      if (!isOrphanTransportLine(line)) continue;
      const key = line.description.trim();
      const bucket = orphansByDescription.get(key) ?? [];
      bucket.push(line);
      orphansByDescription.set(key, bucket);
    }

    let deleted = 0;
    for (const group of orphansByDescription.values()) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
      );
      for (const extra of sorted.slice(1)) {
        if (dryRun) {
          console.log(`  [dry-run] delete orphan duplicate line ${extra.id}`);
        } else {
          await db.delete(costLineItems).where(eq(costLineItems.id, extra.id));
        }
        deleted += 1;
      }
    }
    return deleted;
  }

  const tripRows = tripIdFilter
    ? await db.select({ id: trips.id, name: trips.name }).from(trips).where(eq(trips.id, tripIdFilter))
    : await db
        .select({ id: trips.id, name: trips.name })
        .from(trips)
        .where(
          sql`exists (
            select 1 from ${costLineItems}
            where ${costLineItems.tripId} = ${trips.id}
              and ${costLineItems.category} = 'transport'
              and trim(${costLineItems.description}) ilike 'JR Pass'
            having count(*) > 1
          )`,
        );

  if (!tripRows.length) {
    const allJr = await db
      .select({
        tripId: costLineItems.tripId,
        count: sql<number>`count(*)::int`,
      })
      .from(costLineItems)
      .where(ilike(costLineItems.description, "JR Pass"))
      .groupBy(costLineItems.tripId);

    if (!allJr.length) {
      console.log("No JR Pass finance rows found.");
      return;
    }

    console.log("JR Pass rows by trip:");
    for (const row of allJr) {
      console.log(`  ${row.tripId}: ${row.count}`);
    }
    return;
  }

  console.log(dryRun ? "DRY RUN — no deletes" : "Cleaning duplicate transport finance rows…");

  for (const trip of tripRows) {
    const before = await countJrPassLines(trip.id);
    if (before <= 1 && !tripIdFilter) continue;

    console.log(`\n${trip.name ?? trip.id} (${trip.id})`);
    console.log(`  JR Pass lines before: ${before}`);

    const graph = await loadTripGraph(trip.id);
    if (!graph) {
      console.log("  skip — could not load trip graph");
      continue;
    }

    let repaired = 0;
    if (!dryRun) {
      repaired = await repairTransportProductFinanceLinks(trip.id, graph);
    } else {
      console.log("  [dry-run] would run repairTransportProductFinanceLinks");
    }
    const linkedDupes =
      (await purgeDuplicateLinkedProductLines(trip.id)) +
      (await purgeDuplicateLinkedLegLines(trip.id));
    const orphanDupes = await purgeOrphanTransportDuplicates(trip.id);

    const after = dryRun ? before : await countJrPassLines(trip.id);
    console.log(`  repaired/links: ${repaired}, linked dupes removed: ${linkedDupes}, orphan dupes removed: ${orphanDupes}`);
    console.log(`  JR Pass lines after: ${after}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
