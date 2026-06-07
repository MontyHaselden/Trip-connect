import { and, desc, eq, isNull } from "drizzle-orm";

import { calcGstAmount, calcTotalIncGst } from "@/lib/billing/gst";
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
}) {
  const plan = await getPlanByCode(params.planCode);
  if (!plan) throw new Error(`Plan not found: ${params.planCode}`);

  const gst = await getGstSettings();
  const basePriceCents = plan.basePriceCents;
  const gstAmountCents = gst.gstEnabled
    ? calcGstAmount(basePriceCents, gst.gstRate)
    : 0;
  const totalCents = calcTotalIncGst(basePriceCents, gst.gstEnabled ? gst.gstRate : 0);

  const [sub] = await db
    .insert(subscriptions)
    .values({
      accountId: params.accountId,
      planId: plan.id,
      billingStatus: params.billingStatus ?? "manual",
      basePriceCents,
      gstRate: String(gst.gstRate),
      gstAmountCents,
      totalCents,
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
