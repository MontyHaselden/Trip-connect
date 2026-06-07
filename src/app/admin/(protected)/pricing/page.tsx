import { formatPublicPrice } from "@/lib/billing/gst";
import { getFoundingSchoolMaxSlots, getGstSettings } from "@/lib/billing/settings";
import { loadAllPlans } from "@/lib/plans/plans-db";
import { db } from "@/lib/db/client";
import { hostAccounts } from "@/lib/db/schema";

export default async function AdminPricingPage() {
  const [allPlans, gst, foundingMax] = await Promise.all([
    loadAllPlans(),
    getGstSettings(),
    getFoundingSchoolMaxSlots(),
  ]);

  const accounts = await db.select({ foundingSchool: hostAccounts.foundingSchool }).from(hostAccounts);
  const foundingUsed = accounts.filter((a) => a.foundingSchool).length;

  const visible = allPlans.filter((p) => p.visible);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Public pricing preview</h1>
        <p className="text-sm text-zinc-600">
          Display mode: {gst.gstDisplayMode === "plus_gst" ? "+ GST" : "incl. GST"} at {(gst.gstRate * 100).toFixed(0)}%
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Founding schools: {foundingUsed} / {foundingMax} slots used. Locked founding prices are unaffected by public price changes.
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((plan) => {
          const pricing = formatPublicPrice({
            basePriceCents: plan.basePriceCents,
            billingPeriod: plan.billingPeriod,
            settings: gst,
          });
          const features = Array.isArray(plan.featureList)
            ? (plan.featureList as string[])
            : [];
          return (
            <div key={plan.id} className="rounded-xl border border-zinc-200 bg-white p-5">
              {plan.badge ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                  {plan.badge}
                </span>
              ) : null}
              <h2 className="mt-2 text-lg font-semibold">{plan.name}</h2>
              <p className="text-2xl font-semibold">{pricing.display}</p>
              <p className="mt-1 text-xs text-zinc-500">
                Subtotal {pricing.subtotalCents / 100} · GST {pricing.gstCents / 100} · Total {pricing.totalCents / 100}
              </p>
              <ul className="mt-4 space-y-1 text-sm text-zinc-600">
                {features.slice(0, 5).map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
