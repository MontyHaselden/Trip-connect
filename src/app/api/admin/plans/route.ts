import { NextResponse } from "next/server";

import { adminApiError } from "@/lib/admin/api-errors";
import { requireAdminRole } from "@/lib/admin/permissions";
import { loadAllPlans } from "@/lib/plans/plans-db";
import { getGstSettings } from "@/lib/billing/settings";
import { formatPublicPrice } from "@/lib/billing/gst";

export async function GET() {
  try {
    await requireAdminRole("support");
    const [allPlans, gst] = await Promise.all([loadAllPlans(), getGstSettings()]);
    const plans = allPlans.map((p) => ({
      ...p,
      priceDisplay: formatPublicPrice({
        basePriceCents: p.basePriceCents,
        billingPeriod: p.billingPeriod,
        settings: gst,
      }).display,
    }));
    return NextResponse.json({ plans, gst });
  } catch (err) {
    return adminApiError(err);
  }
}
