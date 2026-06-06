import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";

export default function PricingPage() {
  return (
    <MarketingShell active="pricing">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 text-zinc-600">Example pricing for the prototype — no payments yet.</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border-2 border-zinc-900 bg-white p-8">
            <h2 className="text-xl font-semibold">Starter Trip</h2>
            <p className="mt-2 text-3xl font-semibold">$50</p>
            <p className="text-sm text-zinc-600">per trip</p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-700">
              <li>One trip</li>
              <li>AI itinerary builder</li>
              <li>Student invite link</li>
              <li>Offline student access</li>
              <li>Parent viewer link</li>
              <li>Photo gallery</li>
              <li>Emergency phrases</li>
              <li>Up to 60 participants</li>
            </ul>
            <Link
              href="/signup"
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white"
            >
              Get started
            </Link>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
            <h2 className="text-xl font-semibold">School Plan</h2>
            <p className="mt-2 text-lg text-zinc-600">Coming later</p>
            <p className="mt-4 text-sm text-zinc-600">
              For schools running multiple trips per year. Contact us when you are ready to scale.
            </p>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
