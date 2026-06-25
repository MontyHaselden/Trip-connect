import Link from "next/link";

import { ContinueTripCta } from "./ContinueTripCta";
import { FaqSection } from "./FaqSection";
import { MarketingShell } from "./MarketingShell";
import { MockDesktopBuilder } from "./MockDesktopBuilder";
import { MockPhoneItinerary } from "./MockPhoneItinerary";
import { PayShareSection } from "./PayShareSection";
import { LaunchSchoolPricing } from "./LaunchSchoolPricing";
import { PersonalPricingSection } from "./PricingSection";
import {
  BUILT_FOR_SCHOOLS,
  FEATURES,
  HERO,
  HOW_IT_WORKS,
  PROBLEMS,
  SOLUTIONS,
} from "./marketing-content";

export function LandingPage() {
  return (
    <MarketingShell active="home">
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p className="text-sm font-medium text-sky-700">{HERO.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            {HERO.headline}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-600">{HERO.subheadline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ContinueTripCta />
            <Link
              href="/signup?type=school"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
            >
              Start your school account
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800"
            >
              View demo trip
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800"
            >
              See pricing
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-center gap-6 lg:items-end">
          <MockPhoneItinerary />
          <MockDesktopBuilder />
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">
            School trips should not run from paper booklets and old emails.
          </h2>
          <p className="mt-3 text-zinc-600">Schools often deal with:</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-zinc-700">
                <span className="text-zinc-400">—</span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-8 font-medium text-zinc-900">
            Itinerary Live gives every trip one simple source of truth.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">One live trip hub for the whole school trip.</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {SOLUTIONS.map((s) => (
              <span
                key={s}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">Built for school trips, not generic travel.</h2>
          <p className="mt-4 max-w-3xl text-zinc-600 leading-relaxed">
            Itinerary Live is designed around how school trips actually work. Teachers need control,
            students need clarity, parents need reassurance, and schools need privacy.
          </p>
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

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">Features</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.slice(0, 6).map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5"
              >
                <h3 className="font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.description}</p>
              </div>
            ))}
          </div>
          <Link href="/features" className="mt-6 inline-flex text-sm font-medium text-sky-700">
            See all features →
          </Link>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">From rough plan to live trip hub.</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step} className="rounded-xl border border-zinc-200 p-4">
                <span className="text-xs font-semibold text-sky-700">Step {i + 1}</span>
                <p className="mt-2 text-sm text-zinc-700">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <LaunchSchoolPricing />

      <PersonalPricingSection />

      <PayShareSection />

      <section className="border-y border-zinc-200 bg-zinc-50 py-16">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-2xl font-semibold">Running group trips outside a school?</h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-600">
            Itinerary Live can also work for sports clubs, youth groups, churches, tour organisers,
            language schools, exchange programmes, and corporate retreats.
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Organisation plans coming later
          </p>
          <Link
            href="/signup?type=organisation"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-900"
          >
            Register interest
          </Link>
        </div>
      </section>

      <FaqSection />

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-2xl font-semibold">Start with one school trip.</h2>
          <p className="mt-3 text-zinc-600">
            Create a school account, build your first trip, and give students a clearer way to
            travel.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup?type=school"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
            >
              Create school account
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800"
            >
              View demo trip
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
