import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { calcGstAmount, calcTotalIncGst } from "@/lib/billing/gst";
import {
  FOUNDING_SCHOOL_PRICE_CENTS,
  TRIAL_DAYS,
} from "@/lib/billing/launch-pricing";
import { getGstSettings } from "@/lib/billing/settings";
import { db } from "@/lib/db/client";
import {
  hostAccounts,
  plans,
  priceOverrides,
  subscriptions,
} from "@/lib/db/schema";
import type { SubscriptionPlan } from "@/lib/plans/plan-config";

export async function getPlanByCode(code: SubscriptionPlan) {
  return db
    .select()
    .from(plans)
    .where(eq(plans.code, code))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function getActivePriceOverride(accountId: string) {
  const now = new Date();
  const rows = await db
    .select()
    .from(priceOverrides)
    .where(eq(priceOverrides.accountId, accountId))
    .orderBy(desc(priceOverrides.startsAt));

  return (
    rows.find((o) => {
      if (o.startsAt > now) return false;
      if (o.endsAt && o.endsAt < now) return false;
      return true;
    }) ?? null
  );
}

export async function resolveEffectivePrice(params: {
  accountId: string;
  planId: string;
  planBaseCents: number;
  foundingLocked: boolean;
  overrideId?: string | null;
}) {
  if (params.overrideId) {
    const override = await db
      .select()
      .from(priceOverrides)
      .where(eq(priceOverrides.id, params.overrideId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (override) return override.basePriceCents;
  }

  const activeOverride = await getActivePriceOverride(params.accountId);
  if (activeOverride) return activeOverride.basePriceCents;

  if (params.foundingLocked) {
    const sub = await db
      .select({ basePriceCents: subscriptions.basePriceCents })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.accountId, params.accountId),
          eq(subscriptions.foundingPriceLocked, true),
        ),
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (sub) return sub.basePriceCents;
  }

  return params.planBaseCents;
}

export async function createSubscriptionForAccount(params: {
  accountId: string;
  planCode: SubscriptionPlan;
  billingStatus?: "trial" | "active" | "manual";
  trialDays?: number;
  foundingSchool?: boolean;
  foundingPriceCents?: number;
}) {
  const plan = await getPlanByCode(params.planCode);
  if (!plan) throw new Error(`Plan not found: ${params.planCode}`);

  const gst = await getGstSettings();
  let basePriceCents = plan.basePriceCents;
  let foundingPriceLocked = false;

  if (params.foundingSchool && params.foundingPriceCents != null) {
    basePriceCents = params.foundingPriceCents;
    foundingPriceLocked = true;
  }

  const gstAmountCents = gst.gstEnabled
    ? calcGstAmount(basePriceCents, gst.gstRate)
    : 0;
  const totalCents = calcTotalIncGst(basePriceCents, gst.gstEnabled ? gst.gstRate : 0);

  const billingStatus = params.billingStatus ?? "manual";
  const trialDays = params.trialDays ?? (billingStatus === "trial" ? TRIAL_DAYS : 0);
  const trialEndsAt =
    billingStatus === "trial" && trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
      : null;

  const [sub] = await db
    .insert(subscriptions)
    .values({
      accountId: params.accountId,
      planId: plan.id,
      billingStatus,
      basePriceCents,
      gstRate: String(gst.gstRate),
      gstAmountCents,
      totalCents,
      foundingPriceLocked,
      trialEndsAt,
    })
    .returning();

  await db
    .update(hostAccounts)
    .set({ subscriptionId: sub.id, updatedAt: new Date() })
    .where(eq(hostAccounts.id, params.accountId));

  return sub;
}

export async function getSubscriptionForAccount(accountId: string) {
  return db
    .select({
      subscription: subscriptions,
      plan: plans,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(eq(subscriptions.accountId, accountId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function changeAccountPlan(params: {
  accountId: string;
  planCode: SubscriptionPlan;
  adminId?: string;
}) {
  const plan = await getPlanByCode(params.planCode);
  if (!plan) throw new Error(`Plan not found: ${params.planCode}`);

  const existing = await getSubscriptionForAccount(params.accountId);
  const gst = await getGstSettings();
  const basePriceCents = await resolveEffectivePrice({
    accountId: params.accountId,
    planId: plan.id,
    planBaseCents: plan.basePriceCents,
    foundingLocked: existing?.subscription.foundingPriceLocked ?? false,
    overrideId: existing?.subscription.priceOverrideId,
  });
  const gstAmountCents = gst.gstEnabled
    ? calcGstAmount(basePriceCents, gst.gstRate)
    : 0;
  const totalCents = basePriceCents + gstAmountCents;

  if (existing) {
    const [updated] = await db
      .update(subscriptions)
      .set({
        planId: plan.id,
        basePriceCents,
        gstAmountCents,
        totalCents,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.subscription.id))
      .returning();
    await db
      .update(hostAccounts)
      .set({ plan: params.planCode, updatedAt: new Date() })
      .where(eq(hostAccounts.id, params.accountId));
    return updated;
  }

  return createSubscriptionForAccount({
    accountId: params.accountId,
    planCode: params.planCode,
  });
}

export async function countFoundingSchools(): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hostAccounts)
    .where(eq(hostAccounts.foundingSchool, true))
    .then((rows) => rows[0]);
  return row?.count ?? 0;
}

export async function updateSubscriptionBillingStatus(params: {
  accountId: string;
  billingStatus: (typeof subscriptions.$inferSelect)["billingStatus"];
  clearTrial?: boolean;
}) {
  const existing = await getSubscriptionForAccount(params.accountId);
  if (!existing) throw new Error("No subscription for account.");

  const renewsAt =
    params.billingStatus === "active"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : existing.subscription.renewsAt;

  const [updated] = await db
    .update(subscriptions)
    .set({
      billingStatus: params.billingStatus,
      trialEndsAt: params.clearTrial ? null : existing.subscription.trialEndsAt,
      renewsAt,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.subscription.id))
    .returning();

  if (params.billingStatus === "active") {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    await db
      .update(hostAccounts)
      .set({ planExpiresAt: expires, updatedAt: new Date() })
      .where(eq(hostAccounts.id, params.accountId));
  }

  return updated;
}

export async function extendAccountTrial(params: {
  accountId: string;
  extraDays: number;
}) {
  const existing = await getSubscriptionForAccount(params.accountId);
  if (!existing) throw new Error("No subscription for account.");

  const now = Date.now();
  const currentEnd = existing.subscription.trialEndsAt?.getTime() ?? now;
  const base = Math.max(currentEnd, now);
  const trialEndsAt = new Date(base + params.extraDays * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(subscriptions)
    .set({
      billingStatus: "trial",
      trialEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.subscription.id))
    .returning();

  return updated;
}

export async function applyFoundingSchoolPricing(accountId: string) {
  const existing = await getSubscriptionForAccount(accountId);
  if (!existing) throw new Error("No subscription for account.");

  const gst = await getGstSettings();
  const basePriceCents = FOUNDING_SCHOOL_PRICE_CENTS;
  const gstAmountCents = gst.gstEnabled
    ? calcGstAmount(basePriceCents, gst.gstRate)
    : 0;
  const totalCents = basePriceCents + gstAmountCents;

  const [updated] = await db
    .update(subscriptions)
    .set({
      basePriceCents,
      gstAmountCents,
      totalCents,
      foundingPriceLocked: true,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.subscription.id))
    .returning();

  await db
    .update(hostAccounts)
    .set({ foundingSchool: true, updatedAt: new Date() })
    .where(eq(hostAccounts.id, accountId));

  return updated;
}
