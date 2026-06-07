import { formatCents } from "@/lib/billing/gst";
import { getAdminOverviewStats } from "@/lib/admin/stats";

function StatCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {props.label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900">{props.value}</p>
      {props.sub ? <p className="mt-1 text-xs text-zinc-500">{props.sub}</p> : null}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Overview</h1>
        <p className="mt-1 text-sm text-zinc-600">Platform health and billing snapshot.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Accounts" value={String(stats.accounts.total)} sub={`${stats.accounts.school} school · ${stats.accounts.personal} personal`} />
        <StatCard label="Active trips" value={String(stats.trips.active)} sub={`${stats.trips.completed} completed`} />
        <StatCard label="MRR" value={formatCents(stats.billing.mrrCents)} sub={`ARR ${formatCents(stats.billing.arrCents)}`} />
        <StatCard label="Founding schools" value={`${stats.accounts.founding} / ${stats.accounts.foundingMax}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Invoices due" value={String(stats.billing.invoicesDue)} />
        <StatCard label="Overdue" value={String(stats.billing.invoicesOverdue)} />
        <StatCard label="AI calls" value={String(stats.usage.aiCalls)} sub={`Est. ${formatCents(stats.usage.aiCostCents)}`} />
        <StatCard label="Photos" value={String(stats.usage.photoCount)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="font-semibold text-zinc-900">Plan distribution</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {Object.entries(stats.planDistribution).map(([plan, count]) => (
                <tr key={plan} className="border-t border-zinc-100">
                  <td className="py-2 text-zinc-700">{plan}</td>
                  <td className="py-2 text-right font-medium">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="font-semibold text-zinc-900">PayShare sessions</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {stats.payshare.open} open · {stats.payshare.completed} completed
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            {stats.accounts.paused} paused accounts · {stats.billing.activeSubscriptions} active subscriptions
          </p>
        </div>
      </div>
    </div>
  );
}
