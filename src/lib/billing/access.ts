import { eq } from "drizzle-orm";

import { getSubscriptionForAccount } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";

export type BillingAccessState = {
  accountId: string;
  billingStatus: string;
  paused: boolean;
  trialEndsAt: Date | null;
  trialActive: boolean;
  canPublish: boolean;
  canUseLiveParticipantLinks: boolean;
  canEditTrips: boolean;
  reason?: string;
};

function billingEnforcementDisabled(): boolean {
  return (
    process.env.BILLING_ENFORCEMENT_DISABLED === "true" ||
    process.env.BILLING_ENFORCEMENT_DISABLED === "1"
  );
}

function isTrialActive(trialEndsAt: Date | null, now: Date): boolean {
  if (!trialEndsAt) return false;
  return trialEndsAt.getTime() > now.getTime();
}

function statusAllowsLiveAccess(status: string, trialActive: boolean): boolean {
  if (trialActive) return true;
  return status === "active" || status === "comped" || status === "manual";
}

export async function getBillingAccessState(
  accountId: string,
): Promise<BillingAccessState | null> {
  const account = await db
    .select({
      id: hostAccounts.id,
      pausedAt: hostAccounts.pausedAt,
    })
    .from(hostAccounts)
    .where(eq(hostAccounts.id, accountId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!account) return null;

  const subRow = await getSubscriptionForAccount(accountId);
  const status = subRow?.subscription.billingStatus ?? "manual";
  const trialEndsAt = subRow?.subscription.trialEndsAt ?? null;
  const now = new Date();
  const trialActive = status === "trial" && isTrialActive(trialEndsAt, now);
  const paused = !!account.pausedAt;

  if (billingEnforcementDisabled()) {
    return {
      accountId,
      billingStatus: status,
      paused,
      trialEndsAt,
      trialActive,
      canPublish: !paused,
      canUseLiveParticipantLinks: !paused,
      canEditTrips: !paused,
    };
  }

  if (paused) {
    return {
      accountId,
      billingStatus: status,
      paused: true,
      trialEndsAt,
      trialActive,
      canPublish: false,
      canUseLiveParticipantLinks: false,
      canEditTrips: true,
      reason:
        "This account is paused. Contact support to restore live trip access.",
    };
  }

  const liveOk = statusAllowsLiveAccess(status, trialActive);

  if (!liveOk) {
    const reason =
      status === "trial"
        ? "Your free trial has ended. Contact us to activate your school account and keep live student access."
        : status === "past_due"
          ? "Your account has an overdue invoice. Live student access is paused until payment is received."
          : status === "expired" || status === "cancelled"
            ? "Your subscription has expired. Contact us to renew and restore live student access."
            : "Activate your school account to publish live updates for students.";

    return {
      accountId,
      billingStatus: status,
      paused: false,
      trialEndsAt,
      trialActive,
      canPublish: false,
      canUseLiveParticipantLinks: false,
      canEditTrips: true,
      reason,
    };
  }

  return {
    accountId,
    billingStatus: status,
    paused: false,
    trialEndsAt,
    trialActive,
    canPublish: true,
    canUseLiveParticipantLinks: true,
    canEditTrips: true,
  };
}

export class BillingAccessError extends Error {
  readonly code = "billing_required";

  constructor(message: string) {
    super(message);
    this.name = "BillingAccessError";
  }
}

export async function requireActiveBilling(accountId: string): Promise<BillingAccessState> {
  const state = await getBillingAccessState(accountId);
  if (!state) throw new BillingAccessError("Account not found.");
  if (!state.canPublish) {
    throw new BillingAccessError(
      state.reason ?? "Live publishing requires an active account or trial.",
    );
  }
  return state;
}

export async function canPublishTrip(accountId: string): Promise<boolean> {
  const state = await getBillingAccessState(accountId);
  return state?.canPublish ?? false;
}

export async function canUseLiveParticipantLinks(accountId: string): Promise<boolean> {
  const state = await getBillingAccessState(accountId);
  return state?.canUseLiveParticipantLinks ?? false;
}
