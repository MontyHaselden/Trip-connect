import Link from "next/link";
import { desc } from "drizzle-orm";

import { getAccountUsage } from "@/lib/admin/stats";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";
import { getSubscriptionForAccount } from "@/lib/billing/subscriptions";

export default async function AdminAccountsPage() {
  const rows = await db
    .select()
    .from(hostAccounts)
    .orderBy(desc(hostAccounts.createdAt))
    .limit(200);

  const accounts = await Promise.all(
    rows.map(async (a) => {
      const usage = await getAccountUsage(a.id);
      const sub = await getSubscriptionForAccount(a.id);
      return { account: a, usage, sub };
    }),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Accounts</h1>
        <p className="text-sm text-zinc-600">{accounts.length} accounts</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Trips</th>
              <th className="px-4 py-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(({ account: a, usage, sub }) => (
              <tr key={a.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/accounts/${a.id}`} className="font-medium text-sky-700 hover:underline">
                    {a.fullName}
                  </Link>
                  {a.schoolName ? (
                    <p className="text-xs text-zinc-500">{a.schoolName}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-600">{a.email}</td>
                <td className="px-4 py-3">{a.accountType}</td>
                <td className="px-4 py-3">{a.plan}</td>
                <td className="px-4 py-3">{sub?.subscription.billingStatus ?? "—"}</td>
                <td className="px-4 py-3">
                  {usage.activeTrips} active / {usage.totalTrips}
                </td>
                <td className="px-4 py-3 text-xs">
                  {a.foundingSchool ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Founding</span> : null}
                  {a.pausedAt ? <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-red-800">Paused</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
