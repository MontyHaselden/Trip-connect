import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvLocal();

async function main() {
  const tripId = process.env.TRIP_ID ?? "81f96f12-4b9c-42f2-a32a-443d5ee388c1";
  const { db } = await import("../src/lib/db/client");
  const { costLineItems } = await import("../src/lib/db/schema");

  const rows = await db.select().from(costLineItems).where(eq(costLineItems.tripId, tripId));
  const transport = rows.filter((r) => r.category === "transport");

  const byDesc = new Map<string, number>();
  for (const r of transport) {
    const k = r.description.trim();
    byDesc.set(k, (byDesc.get(k) ?? 0) + 1);
  }

  console.log(`Trip ${tripId}`);
  console.log(`Total cost lines: ${rows.length}`);
  console.log(`Transport lines: ${transport.length}`);
  console.log("Descriptions:");
  for (const [desc, count] of [...byDesc.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}x ${desc}`);
  }
}

main();
