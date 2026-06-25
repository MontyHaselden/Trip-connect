import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { formatPublicPrice } from "@/lib/billing/gst";
import { getGstSettings } from "@/lib/billing/settings";
import { getSubscriptionForAccount } from "@/lib/billing/subscriptions";
import { getValidHostSession } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { hostAccounts, hostTripMembers, trips } from "@/lib/db/schema";
import { getHostAccountById } from "@/lib/host/auth";
import { getActiveTripCountForAccount, getStaffCountForAccount } from "@/lib/plans/account-usage";
import { getAccountPlanWarnings } from "@/lib/plans/enforce-plan";
import { getPlanLimitsFromDb } from "@/lib/plans/plans-db";
import type { SubscriptionPlan } from "@/lib/plans/plan-config";

export async function GET() {
  const session = await getValidHostSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getHostAccountById(session.hostId);
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = account.plan as SubscriptionPlan;
  const limits = await getPlanLimitsFromDb(plan);
  const sub = await getSubscriptionForAccount(session.hostId);
  const gst = await getGstSettings();

  const activeTripCount = await getActiveTripCountForAccount(session.hostId);
  const staffCount = await getStaffCountForAccount(session.hostId);

  const tripRows = await db
    .select({ id: trips.id })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(eq(hostTripMembers.hostId, session.hostId));

  const warnings = await getAccountPlanWarnings({
    accountId: session.hostId,
    activeTripCount,
    staffCount,
  });

  const hostAccount = await db
    .select({
      foundingSchool: hostAccounts.foundingSchool,
      pausedAt: hostAccounts.pausedAt,
    })
    .from(hostAccounts)
    .where(eq(hostAccounts.id, session.hostId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const priceDisplay = sub
    ? formatPublicPrice({
        basePriceCents: sub.subscription.basePriceCents,
        billingPeriod: sub.plan.billingPeriod,
        settings: gst,
      })
    : null;

  return NextResponse.json({
    account: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      accountType: account.accountType,
      plan: account.plan,
      schoolName: account.schoolName,
      jobTitle: account.jobTitle,
      homeCity: account.homeCity,
      defaultAirport: account.defaultAirport,
      planExpiresAt: account.planExpiresAt?.toISOString() ?? null,
      foundingSchool: hostAccount?.foundingSchool ?? false,
      paused: !!hostAccount?.pausedAt,
    },
    limits: {
      label: limits.label,
      staffAccounts: limits.staffAccounts,
      activeTrips: limits.activeTrips,
      groupMax: limits.groupMax,
      aiBuilder: limits.aiBuilder,
      schoolTools: limits.schoolTools,
      priceLabel: limits.priceLabel,
    },
    usage: {
      activeTrips: activeTripCount,
      historyTrips: tripRows.length - activeTripCount,
      staffAccounts: staffCount,
    },
    billing: {
      status: sub?.subscription.billingStatus ?? "manual",
      paymentProvider: sub?.subscription.paymentProvider ?? "manual",
      priceDisplay: priceDisplay?.display ?? limits.priceLabel,
      subtotalCents: sub?.subscription.basePriceCents ?? null,
      overrideActive: !!sub?.subscription.priceOverrideId,
      renewsAt: sub?.subscription.renewsAt?.toISOString() ?? null,
      trialEndsAt: sub?.subscription.trialEndsAt?.toISOString() ?? null,
      foundingSchool: hostAccount?.foundingSchool ?? false,
    },
    warnings,
  });
}
