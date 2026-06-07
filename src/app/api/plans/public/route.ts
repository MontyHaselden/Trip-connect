import { NextResponse } from "next/server";

import { getGstSettings } from "@/lib/billing/settings";
import { getPublicPlans } from "@/lib/plans/plans-db";

export async function GET() {
  const [plans, gst] = await Promise.all([getPublicPlans(), getGstSettings()]);
  return NextResponse.json({ plans, gst });
}
