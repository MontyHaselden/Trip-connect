import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MockPhoneItinerary } from "@/components/marketing/MockPhoneItinerary";
import { MockStaffDashboard } from "@/components/marketing/MockStaffDashboard";

export default function DemoPage() {
  return (
    <MarketingShell active="demo">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Example trip</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            A realistic preview of what students and staff see on a school trip — compact daily
            schedule, accommodation, emergency details, and live updates. No app download required.
          </p>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Student view</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Students open an invite link on their phone and see today&apos;s schedule, tonight&apos;s
              accommodation, and emergency contacts. The itinerary updates when staff publish changes
              — no live GPS tracking.
            </p>
            <div className="mt-8 flex justify-center lg:justify-start">
              <MockPhoneItinerary />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Staff dashboard</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Trip coordinators manage participants, groups, the day schedule, finance summaries, and
              exports from one operations dashboard.
            </p>
            <div className="mt-8">
              <MockStaffDashboard />
            </div>
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-8 text-center">
          <p className="text-zinc-700">
            Create your own school account to build a real trip and preview it with your team.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup?type=school"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Start 7-day free trial
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Book a demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-zinc-500">No payment required during the trial.</p>
        </div>
      </div>
    </MarketingShell>
  );
}
