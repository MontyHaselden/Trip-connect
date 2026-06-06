/**
 * Applies all SQL files in src/lib/db/migrations in order.
 * Safe to re-run — migrations use IF NOT EXISTS / DO blocks where possible.
 *
 * Usage: npm run db:apply
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const dir = join(process.cwd(), "src/lib/db/migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function main() {
  for (const file of files) {
    console.log(`\n--- ${file} ---`);
    const content = readFileSync(join(dir, file), "utf8");
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
      try {
        await sql.query(stmt);
        console.log(`  ok  ${preview}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  err ${preview}`);
        console.error(`       ${msg}`);
      }
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
