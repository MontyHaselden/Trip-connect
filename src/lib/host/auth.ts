import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { acceptPendingInvitesForEmail } from "@/lib/host/accept-invites";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";
import { normalizeToE164 } from "@/lib/utils/phone";

export async function createHostAccount(params: {
  email: string;
  phoneNumber: string;
  defaultCountryCallingCode: string;
  password: string;
  fullName: string;
  role: "teacher" | "helper" | "host" | "admin";
}) {
  const email = params.email.trim().toLowerCase();
  const phoneNumberE164 = normalizeToE164(
    params.phoneNumber,
    params.defaultCountryCallingCode,
  );

  const existing = await db
    .select({
      email: hostAccounts.email,
      phoneNumberE164: hostAccounts.phoneNumberE164,
    })
    .from(hostAccounts)
    .where(eq(hostAccounts.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    throw new Error("An account already exists with that email. Try logging in instead.");
  }

  const phoneTaken = await db
    .select({ id: hostAccounts.id })
    .from(hostAccounts)
    .where(eq(hostAccounts.phoneNumberE164, phoneNumberE164))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (phoneTaken) {
    throw new Error(
      "An account already exists with that phone number. Try logging in instead.",
    );
  }

  const passwordHash = await bcrypt.hash(params.password, 10);

  const [created] = await db
    .insert(hostAccounts)
    .values({
      email,
      phoneNumberE164,
      passwordHash,
      fullName: params.fullName.trim(),
      role: params.role,
    })
    .returning({
      id: hostAccounts.id,
      email: hostAccounts.email,
      fullName: hostAccounts.fullName,
      role: hostAccounts.role,
    });

  if (!created) throw new Error("Failed to create host account.");
  await acceptPendingInvitesForEmail(email, created.id);
  return created;
}

export async function authenticateHostAccount(params: {
  email: string;
  password: string;
}) {
  const email = params.email.trim().toLowerCase();
  const row = await db
    .select({
      id: hostAccounts.id,
      email: hostAccounts.email,
      passwordHash: hostAccounts.passwordHash,
      fullName: hostAccounts.fullName,
      role: hostAccounts.role,
    })
    .from(hostAccounts)
    .where(eq(hostAccounts.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) throw new Error("Invalid email or password.");
  const ok = await bcrypt.compare(params.password, row.passwordHash);
  if (!ok) throw new Error("Invalid email or password.");

  await acceptPendingInvitesForEmail(email, row.id);

  return { id: row.id, email: row.email, fullName: row.fullName, role: row.role };
}

