import { asc, eq } from "drizzle-orm";

import { formatPublicPrice } from "@/lib/billing/gst";
import { getGstSettings } from "@/lib/billing/settings";
import { db } from "@/lib/db/client";
import { plans } from "@/lib/db/schema";
import {
  PLAN_LIMITS,
  type PlanLimits,
  type SubscriptionPlan,
} from "@/lib/plans/plan-config";

export type DbPlan = typeof plans.$inferSelect;

let planCache: DbPlan[] | null = null;
let planCacheAt = 0;
const CACHE_TTL_MS = 60_000;

export async function loadAllPlans(): Promise<DbPlan[]> {
  const now = Date.now();
  if (planCache && now - planCacheAt < CACHE_TTL_MS) return planCache;
  try {
    planCache = await db.select().from(plans).orderBy(asc(plans.sortOrder));
  } catch {
    return [];
  }
  planCacheAt = now;
  return planCache;
}

export function invalidatePlanCache() {
  planCache = null;
}

export async function getPlanFromDb(code: SubscriptionPlan): Promise<DbPlan | null> {
  const all = await loadAllPlans();
  return all.find((p) => p.code === code) ?? null;
}

export function dbPlanToLimits(plan: DbPlan, priceLabel?: string): PlanLimits {
  return {
    label: plan.name,
    accountType: plan.accountType as PlanLimits["accountType"],
    staffAccounts: plan.staffAccountLimit,
    activeTrips: plan.activeTripLimit,
    groupMax: plan.groupSizeLimit,
    aiBuilder: plan.aiBuilderEnabled,
    aiPhrases: plan.aiPhrasesEnabled,
    schoolTools: plan.schoolToolsEnabled,
    validityMonths: plan.billingPeriod === "once" ? 6 : 12,
    priceLabel: priceLabel ?? "",
  };
}

export async function getPlanLimitsFromDb(
  code: SubscriptionPlan,
): Promise<PlanLimits> {
  const plan = await getPlanFromDb(code);
  if (!plan) return PLAN_LIMITS[code];

  const gst = await getGstSettings();
  const { display } = formatPublicPrice({
    basePriceCents: plan.basePriceCents,
    billingPeriod: plan.billingPeriod,
    settings: gst,
  });

  return dbPlanToLimits(plan, display);
}

export async function getPublicPlans() {
  const gst = await getGstSettings();
  const all = await loadAllPlans();
  return all
    .filter((p) => p.visible)
    .map((plan) => {
      const pricing = formatPublicPrice({
        basePriceCents: plan.basePriceCents,
        billingPeriod: plan.billingPeriod,
        settings: gst,
      });
      const features = Array.isArray(plan.featureList)
        ? (plan.featureList as string[])
        : [];
      return {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        accountType: plan.accountType,
        badge: plan.badge,
        description: plan.publicDescription,
        billingPeriod: plan.billingPeriod,
        priceDisplay: pricing.display,
        subtotalCents: pricing.subtotalCents,
        gstCents: pricing.gstCents,
        totalCents: pricing.totalCents,
        features,
        payshareEnabled: plan.payshareEnabled,
        sortOrder: plan.sortOrder,
      };
    });
}
