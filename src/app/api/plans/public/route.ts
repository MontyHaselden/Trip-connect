import { NextResponse } from "next/server";

import { NORMAL_SCHOOL_PRICE_CENTS, FOUNDING_SCHOOL_PRICE_CENTS } from "@/lib/billing/launch-pricing";
import { getGstSettings, getFoundingSchoolMaxSlots } from "@/lib/billing/settings";
import { countFoundingSchools } from "@/lib/billing/subscriptions";
import { formatPublicPrice } from "@/lib/billing/gst";
import { getPublicPlans } from "@/lib/plans/plans-db";

export async function GET() {
  const [plans, gst, foundingUsed, foundingMax] = await Promise.all([
    getPublicPlans(),
    getGstSettings(),
    countFoundingSchools(),
    getFoundingSchoolMaxSlots(),
  ]);

  const foundingPrice = formatPublicPrice({
    basePriceCents: FOUNDING_SCHOOL_PRICE_CENTS,
    billingPeriod: "year",
    settings: gst,
  });
  const normalPrice = formatPublicPrice({
    basePriceCents: NORMAL_SCHOOL_PRICE_CENTS,
    billingPeriod: "year",
    settings: gst,
  });

  return NextResponse.json({
    plans,
    gst,
    foundingOffer: {
      enabled: foundingUsed < foundingMax,
      slotsUsed: foundingUsed,
      slotsMax: foundingMax,
      foundingPriceDisplay: foundingPrice.display,
      normalPriceDisplay: normalPrice.display,
      trialDays: 7,
    },
  });
}
