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

/** Split SQL on semicolons outside of DO $$ ... $$ blocks. */
function splitTopLevelStatements(content: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollarBlock = false;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DO $$")) inDollarBlock = true;

    buf += `${line}\n`;

    if (inDollarBlock && trimmed.endsWith("END $$;")) {
      out.push(buf.trim());
      buf = "";
      inDollarBlock = false;
      continue;
    }

    if (!inDollarBlock && trimmed.endsWith(";")) {
      out.push(buf.trim());
      buf = "";
    }
  }

  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

async function main() {
  for (const file of files) {
    console.log(`\n--- ${file} ---`);
    const content = readFileSync(join(dir, file), "utf8");
    let statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    if (statements.length === 1) {
      statements = splitTopLevelStatements(statements[0]!);
    }

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
