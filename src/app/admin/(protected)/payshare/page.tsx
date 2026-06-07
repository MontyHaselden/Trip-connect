import { desc, eq } from "drizzle-orm";

import { formatCents } from "@/lib/billing/gst";
import { db } from "@/lib/db/client";
import { hostAccounts, payshareSessions } from "@/lib/db/schema";

export default async function AdminPaysharePage() {
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900">PayShare sessions</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Checkout</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No PayShare sessions yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.session.id} className="border-t border-zinc-100">
                  <td className="px-4 py-3 font-mono text-xs">{r.session.sessionId}</td>
                  <td className="px-4 py-3">
                    <p>{r.accountName}</p>
                    <p className="text-xs text-zinc-500">{r.accountEmail}</p>
                  </td>
                  <td className="px-4 py-3">{formatCents(r.session.amountCents)}</td>
                  <td className="px-4 py-3">{r.session.status}</td>
                  <td className="px-4 py-3 text-xs text-sky-700">{r.session.checkoutUrl ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
