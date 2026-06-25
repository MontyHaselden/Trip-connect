import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { createSubscriptionForAccount } from "@/lib/billing/subscriptions";
import {
  DEFAULT_SCHOOL_PLAN,
  FOUNDING_SCHOOL_PRICE_CENTS,
  TRIAL_DAYS,
} from "@/lib/billing/launch-pricing";
import { getSupportEmail, sendEmail } from "@/lib/email/send-email";
import { welcomeEmail } from "@/lib/email/templates";
import { acceptPendingInvitesForEmail } from "@/lib/host/accept-invites";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";
import type { AccountType, SubscriptionPlan } from "@/lib/plans/plan-config";
import { getPlanLimits } from "@/lib/plans/plan-config";
import { normalizeToE164 } from "@/lib/utils/phone";

function planExpiryDate(plan: SubscriptionPlan): Date | null {
  const months = getPlanLimits(plan).validityMonths;
  if (!months) return null;
  const expires = new Date();
  expires.setMonth(expires.getMonth() + months);
  return expires;
}

export async function createHostAccount(params: {
  email: string;
  phoneNumber?: string | null;
  defaultCountryCallingCode?: string;
  password: string;
  fullName: string;
  role?: "teacher" | "helper" | "host" | "admin";
  accountType: AccountType;
  plan: SubscriptionPlan;
  schoolName?: string | null;
  jobTitle?: string | null;
  homeCity?: string | null;
  defaultAirport?: string | null;
  foundingSchool?: boolean;
}) {
  const email = params.email.trim().toLowerCase();

  const existing = await db
    .select({ email: hostAccounts.email })
    .from(hostAccounts)
    .where(eq(hostAccounts.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    throw new Error("An account already exists with that email. Try logging in instead.");
  }

  let phoneNumberE164: string | null = null;
  if (params.phoneNumber?.trim()) {
    phoneNumberE164 = normalizeToE164(
      params.phoneNumber,
      params.defaultCountryCallingCode ?? "NZ",
    );
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
  }

  const passwordHash = await bcrypt.hash(params.password, 10);
  const role =
    params.role ??
    (params.accountType === "personal" ? "host" : "teacher");

  const [created] = await db
    .insert(hostAccounts)
    .values({
      email,
      phoneNumberE164,
      passwordHash,
      fullName: params.fullName.trim(),
      role,
      accountType: params.accountType,
      plan: params.accountType === "school" ? DEFAULT_SCHOOL_PLAN : params.plan,
      schoolName: params.schoolName?.trim() || null,
      jobTitle: params.jobTitle?.trim() || null,
      homeCity: params.homeCity?.trim() || null,
      defaultAirport: params.defaultAirport?.trim() || null,
      foundingSchool: params.foundingSchool ?? false,
      planExpiresAt: planExpiryDate(params.plan),
    })
    .returning({
      id: hostAccounts.id,
      email: hostAccounts.email,
      fullName: hostAccounts.fullName,
      role: hostAccounts.role,
      accountType: hostAccounts.accountType,
      plan: hostAccounts.plan,
    });

  if (!created) throw new Error("Failed to create account.");

  try {
    const isSchool = params.accountType === "school";
    const planCode = isSchool ? DEFAULT_SCHOOL_PLAN : params.plan;
    const sub = await createSubscriptionForAccount({
      accountId: created.id,
      planCode,
      billingStatus: isSchool ? "trial" : "manual",
      trialDays: isSchool ? TRIAL_DAYS : undefined,
      foundingSchool: isSchool && params.foundingSchool,
      foundingPriceCents:
        isSchool && params.foundingSchool ? FOUNDING_SCHOOL_PRICE_CENTS : undefined,
    });

    if (isSchool) {
      const supportEmail = await getSupportEmail();
      const trialEndsAt = sub.trialEndsAt?.toLocaleDateString("en-NZ", {
        dateStyle: "long",
      }) ?? "in 7 days";
      const mail = welcomeEmail({
        fullName: created.fullName,
        trialEndsAt,
        supportEmail,
      });
      void sendEmail({ to: created.email, ...mail });
    }
  } catch {
    // Plans table may not be seeded yet in dev
  }

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
      accountType: hostAccounts.accountType,
      plan: hostAccounts.plan,
    })
    .from(hostAccounts)
    .where(eq(hostAccounts.email, email))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) throw new Error("Invalid email or password.");
  const ok = await bcrypt.compare(params.password, row.passwordHash);
  if (!ok) throw new Error("Invalid email or password.");

  await acceptPendingInvitesForEmail(email, row.id);

  return row;
}

export async function getHostAccountById(hostId: string) {
  return db
    .select({
      id: hostAccounts.id,
      email: hostAccounts.email,
      fullName: hostAccounts.fullName,
      role: hostAccounts.role,
      accountType: hostAccounts.accountType,
      plan: hostAccounts.plan,
      schoolName: hostAccounts.schoolName,
      jobTitle: hostAccounts.jobTitle,
      homeCity: hostAccounts.homeCity,
      defaultAirport: hostAccounts.defaultAirport,
      planExpiresAt: hostAccounts.planExpiresAt,
    })
    .from(hostAccounts)
    .where(eq(hostAccounts.id, hostId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}
