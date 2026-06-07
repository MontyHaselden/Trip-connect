/**
 * One-time bootstrap for the founder super_admin account.
 *
 * Required env:
 *   DATABASE_URL
 *   SESSION_SECRET (not used here but app requires it)
 *   ADMIN_BOOTSTRAP_EMAIL
 *   ADMIN_BOOTSTRAP_PASSWORD
 *   ADMIN_BOOTSTRAP_SECRET — must match to run
 *
 * Refuses if any admin_users row already exists.
 *
 * SQL alternative (replace placeholders, hash password with bcrypt first):
 *   INSERT INTO admin_users (email, password_hash, full_name, role)
 *   VALUES ('you@example.com', '$2a$10$...', 'Founder', 'super_admin');
 *
 * Usage: ADMIN_BOOTSTRAP_SECRET=... ADMIN_BOOTSTRAP_EMAIL=... ADMIN_BOOTSTRAP_PASSWORD=... npx tsx scripts/bootstrap-super-admin.ts
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const secret = process.env.ADMIN_BOOTSTRAP_SECRET;

if (!databaseUrl || !email || !password || !secret) {
  console.error(
    "DATABASE_URL, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, and ADMIN_BOOTSTRAP_SECRET are required.",
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_BOOTSTRAP_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

async function main() {
  const sql = neon(databaseUrl!);
  const existing = await sql`SELECT id FROM admin_users LIMIT 1`;
  if (existing.length > 0) {
    console.error("Admin user(s) already exist. Bootstrap refused.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password!, 10);
  const fullName = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Founder";

  await sql`
    INSERT INTO admin_users (email, password_hash, full_name, role)
    VALUES (${email}, ${passwordHash}, ${fullName}, 'super_admin')
  `;

  console.log(`Super admin created for ${email}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
