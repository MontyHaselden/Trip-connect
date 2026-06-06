import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MockPhoneItinerary } from "@/components/marketing/MockPhoneItinerary";

export default function DemoPage() {
  return (
    <MarketingShell active="demo">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Demo trip</h1>
            <p className="mt-4 text-zinc-600 leading-relaxed">
              Preview the compact student Today screen — a clean run sheet, not a pile of cards.
              Weather, categories, and offline access are built in.
            </p>
            <p className="mt-4 text-sm text-zinc-600">
              Run <code className="rounded bg-zinc-100 px-1">npm run seed:japan</code> to load a
              full Japan demo in your database, then join with the printed invite code.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
              >
                Create host account
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 px-6 text-sm font-medium"
              >
                Host dashboard
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <MockPhoneItinerary />
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
