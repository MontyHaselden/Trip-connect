import { eq } from "drizzle-orm";

import { getEnforcementMode } from "@/lib/billing/settings";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";
import {
  getPlanLimitsFromDb,
  type DbPlan,
  getPlanFromDb,
} from "@/lib/plans/plans-db";
import type { SubscriptionPlan } from "@/lib/plans/plan-config";

export type EffectiveLimits = {
  staffAccounts: number;
  activeTrips: number;
  aiBuilder: boolean;
  viewerLinks: boolean;
  photoGallery: boolean;
  enforcementMode: "soft" | "hard";
};

export async function getAccountEffectiveLimits(
  accountId: string,
): Promise<EffectiveLimits | null> {
  const account = await db
    .select()
    .from(hostAccounts)
    .where(eq(hostAccounts.id, accountId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!account) return null;

  const planCode = account.plan as SubscriptionPlan;
  const plan = await getPlanFromDb(planCode);
  const limits = plan
    ? {
        staffAccounts: plan.staffAccountLimit,
        activeTrips: plan.activeTripLimit,
        aiBuilder: plan.aiBuilderEnabled,
        viewerLinks: plan.viewerAccessEnabled,
        photoGallery: plan.photoGalleryEnabled,
      }
    : {
        staffAccounts: 1,
        activeTrips: 1,
        aiBuilder: false,
        viewerLinks: true,
        photoGallery: true,
      };

  const enforcementMode = await getEnforcementMode();

  return {
    staffAccounts: account.overrideStaffLimit ?? limits.staffAccounts,
    activeTrips: account.overrideActiveTripLimit ?? limits.activeTrips,
    aiBuilder: account.overrideAiBuilder ?? limits.aiBuilder,
    viewerLinks: account.overrideViewerLinks ?? limits.viewerLinks,
    photoGallery: account.overridePhotoGallery ?? limits.photoGallery,
    enforcementMode,
  };
}

export type EnforcementResult = {
  allowed: boolean;
  softWarning?: string;
  hardBlock?: string;
};

export async function enforceActiveTripLimit(params: {
  accountId: string;
  activeTripCount: number;
}): Promise<EnforcementResult> {
  const limits = await getAccountEffectiveLimits(params.accountId);
  if (!limits) return { allowed: true };

  if (params.activeTripCount < limits.activeTrips) return { allowed: true };

  const message = `Your plan allows up to ${limits.activeTrips} active trips. Completed trips move to history and free up a slot.`;
  if (limits.enforcementMode === "hard") {
    return { allowed: false, hardBlock: message };
  }
  return { allowed: true, softWarning: message };
}

export async function enforceStaffLimit(params: {
  accountId: string;
  staffCount: number;
}): Promise<EnforcementResult> {
  const limits = await getAccountEffectiveLimits(params.accountId);
  if (!limits) return { allowed: true };

  if (params.staffCount < limits.staffAccounts) return { allowed: true };

  const message = `Your plan allows up to ${limits.staffAccounts} staff accounts.`;
  if (limits.enforcementMode === "hard") {
    return { allowed: false, hardBlock: message };
  }
  return { allowed: true, softWarning: message };
}

export async function enforceAiBuilder(accountId: string): Promise<EnforcementResult> {
  const limits = await getAccountEffectiveLimits(accountId);
  if (!limits) return { allowed: false, hardBlock: "AI builder not available." };
  if (limits.aiBuilder) return { allowed: true };

  const message = "AI itinerary builder is not included in your plan.";
  if (limits.enforcementMode === "hard") {
    return { allowed: false, hardBlock: message };
  }
  return { allowed: true, softWarning: message };
}

export async function enforcePhotoGallery(accountId: string): Promise<EnforcementResult> {
  const limits = await getAccountEffectiveLimits(accountId);
  if (!limits) return { allowed: true };
  if (limits.photoGallery) return { allowed: true };

  const message = "Photo gallery is not included in your plan.";
  if (limits.enforcementMode === "hard") {
    return { allowed: false, hardBlock: message };
  }
  return { allowed: true, softWarning: message };
}

export async function enforceViewerLinks(accountId: string): Promise<EnforcementResult> {
  const limits = await getAccountEffectiveLimits(accountId);
  if (!limits) return { allowed: true };
  if (limits.viewerLinks) return { allowed: true };

  const message = "Viewer links are not included in your plan.";
  if (limits.enforcementMode === "hard") {
    return { allowed: false, hardBlock: message };
  }
  return { allowed: true, softWarning: message };
}

export async function getAccountPlanWarnings(params: {
  accountId: string;
  activeTripCount: number;
  staffCount: number;
}): Promise<string[]> {
  const warnings: string[] = [];
  const trip = await enforceActiveTripLimit(params);
  if (trip.softWarning) warnings.push(trip.softWarning);
  const staff = await enforceStaffLimit(params);
  if (staff.softWarning) warnings.push(staff.softWarning);
  return warnings;
}
