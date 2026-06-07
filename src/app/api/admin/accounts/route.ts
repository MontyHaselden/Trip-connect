import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminApiError } from "@/lib/admin/api-errors";
import { getAccountUsage } from "@/lib/admin/stats";
import { requireAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";
import { getSubscriptionForAccount } from "@/lib/billing/subscriptions";

export async function GET(req: Request) {
  try {
    await requireAdminRole("support");
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const type = url.searchParams.get("type");

    let rows = await db
      .select()
      .from(hostAccounts)
      .orderBy(desc(hostAccounts.createdAt))
      .limit(200);

    if (q) {
      rows = rows.filter(
        (a) =>
          a.email.toLowerCase().includes(q.toLowerCase()) ||
          (a.schoolName?.toLowerCase().includes(q.toLowerCase()) ?? false) ||
          a.fullName.toLowerCase().includes(q.toLowerCase()),
      );
    }
    if (type === "school" || type === "personal") {
      rows = rows.filter((a) => a.accountType === type);
    }

    const accounts = await Promise.all(
      rows.map(async (a) => {
        const usage = await getAccountUsage(a.id);
        const sub = await getSubscriptionForAccount(a.id);
        return {
          id: a.id,
          email: a.email,
          fullName: a.fullName,
          accountType: a.accountType,
          plan: a.plan,
          schoolName: a.schoolName,
          foundingSchool: a.foundingSchool,
          pausedAt: a.pausedAt?.toISOString() ?? null,
          billingStatus: sub?.subscription.billingStatus ?? null,
          usage,
          createdAt: a.createdAt.toISOString(),
        };
      }),
    );

    return NextResponse.json({ accounts });
  } catch (err) {
    return adminApiError(err);
  }
}
