import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { adminAuditLog, adminUsers } from "@/lib/db/schema";

export default async function AdminAuditLogPage() {
  const rows = await db
    .select({
      log: adminAuditLog,
      adminEmail: adminUsers.email,
    })
    .from(adminAuditLog)
    .leftJoin(adminUsers, eq(adminUsers.id, adminAuditLog.adminUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900">Audit log</h1>
      <p className="text-sm text-zinc-600">Append-only record of admin actions.</p>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.log.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {r.log.createdAt.toISOString().slice(0, 19)}
                </td>
                <td className="px-4 py-3">{r.adminEmail ?? "—"}</td>
                <td className="px-4 py-3">{r.log.action}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {r.log.entityType}
                  {r.log.entityId ? `:${r.log.entityId.slice(0, 8)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
