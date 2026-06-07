import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminApiError } from "@/lib/admin/api-errors";
import { requireAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/db/client";
import { adminAuditLog, adminUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await requireAdminRole("support");
    const url = new URL(req.url);
    const entityType = url.searchParams.get("entityType");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 500);

    let rows = await db
      .select({
        log: adminAuditLog,
        adminEmail: adminUsers.email,
        adminName: adminUsers.fullName,
      })
      .from(adminAuditLog)
      .leftJoin(adminUsers, eq(adminUsers.id, adminAuditLog.adminUserId))
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(limit);

    if (entityType) {
      rows = rows.filter((r) => r.log.entityType === entityType);
    }

    return NextResponse.json({
      entries: rows.map((r) => ({
        ...r.log,
        adminEmail: r.adminEmail,
        adminName: r.adminName,
      })),
    });
  } catch (err) {
    return adminApiError(err);
  }
}
