import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminApiError } from "@/lib/admin/api-errors";
import { requireAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/db/client";
import { hostAccounts, payshareSessions } from "@/lib/db/schema";

export async function GET() {
  try {
    await requireAdminRole("support");

    const rows = await db
      .select({
        session: payshareSessions,
        accountEmail: hostAccounts.email,
        accountName: hostAccounts.fullName,
      })
      .from(payshareSessions)
      .innerJoin(hostAccounts, eq(hostAccounts.id, payshareSessions.accountId))
      .orderBy(desc(payshareSessions.createdAt))
      .limit(200);

    return NextResponse.json({
      sessions: rows.map((r) => ({
        ...r.session,
        accountEmail: r.accountEmail,
        accountName: r.accountName,
      })),
    });
  } catch (err) {
    return adminApiError(err);
  }
}
