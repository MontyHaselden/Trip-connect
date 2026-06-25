import Link from "next/link";

import { ContinueTripCta } from "./ContinueTripCta";
import { FaqSection } from "./FaqSection";
import { MarketingShell } from "./MarketingShell";
import { MockPhoneItinerary } from "./MockPhoneItinerary";
import { MockStaffDashboard } from "./MockStaffDashboard";
import { LaunchSchoolPricing } from "./LaunchSchoolPricing";
import {
  BUILT_FOR_SCHOOLS,
  FINANCE_POINTS,
  HERO,
  HOW_IT_WORKS,
  PRODUCT_CAPABILITIES,
  PROBLEMS,
  STAFF_OPS_POINTS,
  STUDENT_VIEW_POINTS,
} from "./marketing-content";

function SectionHeading(props: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        {props.title}
      </h2>
      {props.subtitle ? (
        <p className="mt-3 text-base leading-relaxed text-zinc-600">{props.subtitle}</p>
      ) : null}
    </div>
  );
}

function BulletList(props: { items: readonly string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {props.items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed text-zinc-700">
          <span className="mt-0.5 shrink-0 text-sky-600" aria-hidden>
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LandingPage() {
  return (
    <MarketingShell active="home">
      {/* A. Hero */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-20">
        <div>
          <p className="text-sm font-medium text-sky-700">{HERO.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            {HERO.headline}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-600">{HERO.subheadline}</p>
          <p className="mt-4 text-sm font-medium text-zinc-800">{HERO.trialLine}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup?type=school"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create school account
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Book a demo
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              View example trip
            </Link>
            <ContinueTripCta />
          </div>
          <p className="mt-4 text-sm text-zinc-500">{HERO.noGpsLine}</p>
        </div>
        <div className="flex flex-col items-center gap-8 lg:items-end">
          <MockPhoneItinerary />
        </div>
      </section>

      {/* B. Problem */}
      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            title="School trips still run on PDFs, spreadsheets, and group chats."
            subtitle="When plans change — and they always do — keeping everyone aligned becomes the hard part."
          />
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <li
                key={p}
                className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3 text-sm leading-relaxed text-zinc-700"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* C. Product solution */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            title="One live trip hub for your whole school trip."
            subtitle="Plan the trip, publish updates, and keep students on the right schedule — from one organised dashboard."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_CAPABILITIES.map((s) => (
              <div
                key={s}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm"
              >
                {s}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* D. Student / parent view */}
      <section className="border-y border-zinc-200 bg-zinc-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              title="Students and parents see a clear, mobile-friendly schedule."
              subtitle="No social feed. No live tracking. Just the latest itinerary, emergency details, and what matters today."
            />
            <BulletList items={STUDENT_VIEW_POINTS} />
          </div>
          <div className="flex justify-center lg:justify-end">
            <MockPhoneItinerary />
          </div>
        </div>
      </section>

      {/* E. Staff operations */}
      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-2 lg:items-start">
          <div className="order-2 lg:order-1">
            <MockStaffDashboard />
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeading
              title="Staff run the trip from one operations dashboard."
              subtitle="Trip setup, participants, groups, publishing, and exports — without juggling separate tools."
            />
            <BulletList items={STAFF_OPS_POINTS} />
          </div>
        </div>
      </section>

      {/* F. Finance / export */}
      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            title="Finance summaries built from the itinerary."
            subtitle="Costs follow the trip plan — not a separate spreadsheet that goes stale."
          />
          <BulletList items={FINANCE_POINTS} />
        </div>
      </section>

      {/* Built for schools */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading title="Built for school trips, not generic travel apps." />
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {BUILT_FOR_SCHOOLS.map((point) => (
              <li key={point} className="flex gap-2 text-sm text-zinc-700">
                <span className="text-sky-600">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-zinc-200 bg-zinc-50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading title="From account setup to live trip in a few steps." />
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <span className="text-xs font-semibold text-sky-700">Step {i + 1}</span>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* G. Trial / pricing */}
      <LaunchSchoolPricing />

      <FaqSection />

      {/* H. Final CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            Ready to try Itinerary Live with your school?
          </h2>
          <p className="mt-4 text-zinc-600">
            Create a school account with a 7-day free trial — no card required. Build your first trip
            and preview what students will see before any invoice.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup?type=school"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create school account
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Book a setup call
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
