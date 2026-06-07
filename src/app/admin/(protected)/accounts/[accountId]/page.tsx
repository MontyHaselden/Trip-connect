import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { AccountDetailPanel } from "@/components/admin/AccountDetailPanel";
import { formatCents } from "@/lib/billing/gst";
import { getAccountUsage } from "@/lib/admin/stats";
import { getSubscriptionForAccount } from "@/lib/billing/subscriptions";
import { db } from "@/lib/db/client";
import {
  adminAuditLog,
  hostAccounts,
  hostTripMembers,
  invoices,
  payshareSessions,
  plans,
  trips,
} from "@/lib/db/schema";

export default async function AdminAccountDetailPage(props: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await props.params;

  const account = await db
    .select()
    .from(hostAccounts)
    .where(eq(hostAccounts.id, accountId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!account) notFound();

  const [sub, usage, allPlans] = await Promise.all([
    getSubscriptionForAccount(accountId),
    getAccountUsage(accountId),
    db.select({ code: plans.code }).from(plans),
  ]);

  const tripRows = await db
    .select({
      id: trips.id,
      name: trips.name,
      startDate: trips.startDate,
      endDate: trips.endDate,
    })
    .from(trips)
    .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
    .where(eq(hostTripMembers.hostId, accountId));

  const accountInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.accountId, accountId));

  const sessions = await db
    .select()
    .from(payshareSessions)
    .where(eq(payshareSessions.accountId, accountId));

  const audit = await db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.entityId, accountId))
    .limit(10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{account.fullName}</h1>
        <p className="text-sm text-zinc-600">{account.email}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">Account</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-zinc-500">Type</dt><dd>{account.accountType}</dd></div>
              <div><dt className="text-zinc-500">Plan</dt><dd>{account.plan}</dd></div>
              <div><dt className="text-zinc-500">School</dt><dd>{account.schoolName ?? "—"}</dd></div>
              <div><dt className="text-zinc-500">Billing status</dt><dd>{sub?.subscription.billingStatus ?? "—"}</dd></div>
              {sub ? (
                <div>
                  <dt className="text-zinc-500">Effective price (ex-GST)</dt>
                  <dd>{formatCents(sub.subscription.basePriceCents)}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">Usage</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {usage.activeTrips} active trips · {usage.totalTrips} total · {usage.aiCalls} AI calls
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">Trips</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {tripRows.map((t) => (
                <li key={t.id}>{t.name} — {t.startDate} to {t.endDate}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="font-semibold">Invoices</h2>
            {accountInvoices.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No invoices yet.</p>
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1">Number</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {accountInvoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-zinc-100">
                      <td className="py-2">{inv.invoiceNumber}</td>
                      <td>{inv.status}</td>
                      <td>{formatCents(inv.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <AccountDetailPanel
          accountId={accountId}
          plan={account.plan}
          foundingSchool={account.foundingSchool}
          paused={!!account.pausedAt}
          internalNotes={account.internalNotes}
          overrideAiBuilder={account.overrideAiBuilder}
          overrideViewerLinks={account.overrideViewerLinks}
          overridePhotoGallery={account.overridePhotoGallery}
          overrideActiveTripLimit={account.overrideActiveTripLimit}
          overrideStaffLimit={account.overrideStaffLimit}
          plans={allPlans.map((p) => p.code)}
        />
      </div>
    </div>
  );
}
