import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { adminUsers } from "@/lib/db/schema";
import type { AdminSessionPayload } from "@/lib/auth/admin-session";

export type AdminRole = AdminSessionPayload["role"];

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  active: boolean;
};

export async function getAdminById(id: string): Promise<AdminUser | null> {
  const row = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      fullName: adminUsers.fullName,
      role: adminUsers.role,
      active: adminUsers.active,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!row || !row.active) return null;
  return row;
}

export async function authenticateAdmin(params: {
  email: string;
  password: string;
}): Promise<AdminUser> {
  const email = params.email.trim().toLowerCase();
  const row = await db
    .select()
    .from(adminUsers)
    .where(and(eq(adminUsers.email, email), eq(adminUsers.active, true)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) throw new Error("Invalid email or password.");
  const ok = await bcrypt.compare(params.password, row.passwordHash);
  if (!ok) throw new Error("Invalid email or password.");

  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    active: row.active,
  };
}

export async function createAdminUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: AdminRole;
}): Promise<AdminUser> {
  const email = params.email.trim().toLowerCase();
  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (existing) throw new Error("An admin with that email already exists.");

  const passwordHash = await bcrypt.hash(params.password, 10);
  const [created] = await db
    .insert(adminUsers)
    .values({
      email,
      passwordHash,
      fullName: params.fullName.trim(),
      role: params.role,
    })
    .returning({
      id: adminUsers.id,
      email: adminUsers.email,
      fullName: adminUsers.fullName,
      role: adminUsers.role,
      active: adminUsers.active,
    });

  return created;
}

export async function adminExists(): Promise<boolean> {
  const row = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return !!row;
}
