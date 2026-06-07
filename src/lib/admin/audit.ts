import { db } from "@/lib/db/client";
import { adminAuditLog } from "@/lib/db/schema";

export async function logAdminAction(params: {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  req?: Request;
}) {
  const ip =
    params.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    params.req?.headers.get("x-real-ip") ??
    null;
  const userAgent = params.req?.headers.get("user-agent") ?? null;

  await db.insert(adminAuditLog).values({
    adminUserId: params.adminId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    beforeJson: params.before ?? null,
    afterJson: params.after ?? null,
    ipAddress: ip,
    userAgent,
  });
}
