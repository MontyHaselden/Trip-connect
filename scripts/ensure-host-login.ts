/**
 * Create or reset a host login for local dev.
 *
 * Usage:
 *   HOST_EMAIL=montgomery@payshare.nz HOST_PASSWORD='Chatham123@' npx tsx scripts/ensure-host-login.ts
 *
 * Loads DATABASE_URL (and other vars) from .env.local when present.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

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

  const email = (process.env.HOST_EMAIL ?? "montgomery@payshare.nz").trim().toLowerCase();
  const password = process.env.HOST_PASSWORD ?? "Chatham123@";
  if (password.length < 8) {
    throw new Error("HOST_PASSWORD must be at least 8 characters.");
  }

  const { db } = await import("../src/lib/db/client");
  const { hostAccounts } = await import("../src/lib/db/schema");
  const { createHostAccount } = await import("../src/lib/host/auth");

  const existing = await db
    .select({ id: hostAccounts.id })
    .from(hostAccounts)
    .where(eq(hostAccounts.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .update(hostAccounts)
      .set({
        passwordHash,
        fullName: process.env.HOST_NAME?.trim() || "Montgomery Haselden",
        plan: "school_starter",
        accountType: "school",
        schoolName: process.env.HOST_SCHOOL?.trim() || "Payshare",
        role: "teacher",
      })
      .where(eq(hostAccounts.email, email));
    console.log(`Login ready: ${email} (host id ${existing.id})`);
    return;
  }

  const acc = await createHostAccount({
    email,
    password,
    fullName: process.env.HOST_NAME?.trim() || "Montgomery Haselden",
    accountType: "school",
    plan: "school_starter",
    schoolName: process.env.HOST_SCHOOL?.trim() || "Payshare",
    role: "teacher",
  });
  console.log(`Created login: ${acc.email} (host id ${acc.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
