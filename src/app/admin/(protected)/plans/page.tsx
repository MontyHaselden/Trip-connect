import { PlanEditor } from "@/components/admin/PlanEditor";
import { formatPublicPrice } from "@/lib/billing/gst";
import { getGstSettings } from "@/lib/billing/settings";
import { loadAllPlans } from "@/lib/plans/plans-db";

export default async function AdminPlansPage() {
  const [allPlans, gst] = await Promise.all([loadAllPlans(), getGstSettings()]);
  const plans = allPlans.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    basePriceCents: p.basePriceCents,
    billingPeriod: p.billingPeriod,
    staffAccountLimit: p.staffAccountLimit,
    activeTripLimit: p.activeTripLimit,
    visible: p.visible,
    badge: p.badge,
    priceDisplay: formatPublicPrice({
      basePriceCents: p.basePriceCents,
      billingPeriod: p.billingPeriod,
      settings: gst,
    }).display,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Plans</h1>
        <p className="text-sm text-zinc-600">Edit limits, visibility, and base prices (ex-GST).</p>
      </div>
      <PlanEditor plans={plans} />
    </div>
  );
}
