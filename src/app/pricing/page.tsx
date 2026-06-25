import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FaqSection } from "@/components/marketing/FaqSection";
import { LaunchSchoolPricing } from "@/components/marketing/LaunchSchoolPricing";
import { PRODUCT_NAME } from "@/lib/brand";

export default function PricingPage() {
  return (
    <MarketingShell active="pricing">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          One simple school plan. No per-student fees. Start with a 7-day free trial — build your
          trip and preview the student view before you pay.
        </p>
      </div>
      <LaunchSchoolPricing />
      <FaqSection />
      <div className="mx-auto max-w-3xl px-5 pb-16 text-center">
        <Link
          href="/signup?type=school"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
        >
          Start 7-day free trial
        </Link>
        <p className="mt-3 text-sm text-zinc-500">
          Questions? <Link href="/contact" className="text-violet-700 hover:underline">Contact us</Link>{" "}
          for founding-school pricing or a demo call.
        </p>
      </div>
    </MarketingShell>
  );
}
