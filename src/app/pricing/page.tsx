import Link from "next/link";

import { FaqSection } from "@/components/marketing/FaqSection";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PayShareSection } from "@/components/marketing/PayShareSection";
import {
  PersonalPricingSection,
  SchoolPricingSection,
} from "@/components/marketing/PricingSection";

export default function PricingPage() {
  return (
    <MarketingShell active="pricing">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Simple yearly school licences with no per-student fees. Personal options for family and
          group trips appear below.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Billing is placeholder for now — plans are selected at signup.
        </p>
      </div>
      <SchoolPricingSection showNotes />
      <PersonalPricingSection />
      <PayShareSection />
      <FaqSection />
      <div className="mx-auto max-w-3xl px-5 pb-16 text-center">
        <Link
          href="/signup?type=school"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
        >
          Create school account
        </Link>
      </div>
    </MarketingShell>
  );
}
