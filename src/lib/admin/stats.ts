import { count, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  aiUsageEvents,
  hostAccounts,
  hostTripMembers,
  invoices,
  payshareSessions,
  plans,
  subscriptions,
  tripPhotos,
  trips,
} from "@/lib/db/schema";
import { getFoundingSchoolMaxSlots } from "@/lib/billing/settings";
import { isTripCompleted } from "@/lib/host/trip-delete-eligibility";

export async function getAdminOverviewStats() {
  const accounts = await db.select().from(hostAccounts);
  const allTrips = await db
    .select({
      id: trips.id,
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      publishedVersion: trips.publishedVersion,
    })
    .from(trips);

  const activeTrips = allTrips.filter(
    (t) => !isTripCompleted(t),
  ).length;
  const completedTrips = allTrips.length - activeTrips;

  const subs = await db
    .select({
      basePriceCents: subscriptions.basePriceCents,
      billingStatus: subscriptions.billingStatus,
      planId: subscriptions.planId,
    })
    .from(subscriptions);

  const planRows = await db.select().from(plans);
  const planById = new Map(planRows.map((p) => [p.id, p]));

  let mrrCents = 0;
  for (const sub of subs) {
    if (!["active", "manual", "trial", "comped"].includes(sub.billingStatus)) continue;
    const plan = planById.get(sub.planId);
    const period = plan?.billingPeriod ?? "year";
    if (period === "once") continue;
    const monthly =
      period === "month" ? sub.basePriceCents : Math.round(sub.basePriceCents / 12);
    mrrCents += monthly;
  }

  const invoiceRows = await db
    .select({ status: invoices.status })
    .from(invoices);
  const invoicesDue = invoiceRows.filter((i) =>
    ["issued", "sent"].includes(i.status),
  ).length;
  const invoicesOverdue = invoiceRows.filter((i) => i.status === "overdue").length;

  const foundingCount = accounts.filter((a) => a.foundingSchool).length;
  const foundingMax = await getFoundingSchoolMaxSlots();

  const planDistribution: Record<string, number> = {};
  for (const a of accounts) {
    planDistribution[a.plan] = (planDistribution[a.plan] ?? 0) + 1;
  }

  const [photoCount] = await db
    .select({ n: count() })
    .from(tripPhotos);
  const [aiUsage] = await db
    .select({
      calls: sql<number>`coalesce(sum(${aiUsageEvents.callCount}), 0)`,
      cost: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostCents}), 0)`,
    })
    .from(aiUsageEvents);

  const [payshareOpen] = await db
    .select({ n: count() })
    .from(payshareSessions)
    .where(eq(payshareSessions.status, "pending"));
  const [payshareDone] = await db
    .select({ n: count() })
    .from(payshareSessions)
    .where(eq(payshareSessions.status, "completed"));

  return {
    accounts: {
      total: accounts.length,
      school: accounts.filter((a) => a.accountType === "school").length,
      personal: accounts.filter((a) => a.accountType === "personal").length,
      paused: accounts.filter((a) => a.pausedAt).length,
      founding: foundingCount,
      foundingMax,
    },
    trips: {
      total: allTrips.length,
      active: activeTrips,
      completed: completedTrips,
    },
    billing: {
      mrrCents,
      arrCents: mrrCents * 12,
      invoicesDue,
      invoicesOverdue,
      activeSubscriptions: subs.filter((s) =>
        ["active", "manual", "trial"].includes(s.billingStatus),
      ).length,
    },
    planDistribution,
    usage: {
      photoCount: photoCount?.n ?? 0,
      aiCalls: Number(aiUsage?.calls ?? 0),
      aiCostCents: Number(aiUsage?.cost ?? 0),
    },
    payshare: {
      open: payshareOpen?.n ?? 0,
      completed: payshareDone?.n ?? 0,
    },
  };
}

export async function getAccountUsage(accountId: string) {
  const tripRows = await db
    .select({
      id: trips.id,
      startDate: trips.startDate,
      endDate: trips.endDate,
      timezone: trips.timezone,
      publishedVersion: trips.publishedVersion,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(eq(hostTripMembers.hostId, accountId));

  const activeTrips = tripRows.filter((t) => !isTripCompleted(t)).length;

  const [staffCount] = await db
    .select({ n: count() })
    .from(hostTripMembers)
    .where(eq(hostTripMembers.hostId, accountId));

  const [aiUsage] = await db
    .select({
      calls: sql<number>`coalesce(sum(${aiUsageEvents.callCount}), 0)`,
      cost: sql<number>`coalesce(sum(${aiUsageEvents.estimatedCostCents}), 0)`,
    })
    .from(aiUsageEvents)
    .where(eq(aiUsageEvents.accountId, accountId));

  return {
    activeTrips,
    totalTrips: tripRows.length,
    staffMemberships: staffCount?.n ?? 0,
    aiCalls: Number(aiUsage?.calls ?? 0),
    aiCostCents: Number(aiUsage?.cost ?? 0),
  };
}
