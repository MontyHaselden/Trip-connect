import Link from "next/link";

import { ContinueTripCta } from "./ContinueTripCta";
import { MarketingShell } from "./MarketingShell";
import { MockPhoneItinerary } from "./MockPhoneItinerary";
import {
  FEATURES,
  HOW_IT_WORKS,
  PROBLEMS,
  SOLUTIONS,
} from "./marketing-content";

export function LandingPage() {
  return (
    <MarketingShell active="home">
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p className="text-sm font-medium text-sky-700">School trip itineraries, rebuilt for phones</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
            The live school trip booklet students can actually use.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-600">
            Trip Connect gives students, teachers, parents, and helpers one clear place for
            the itinerary, emergency info, daily weather, trip photos, rooms, groups, and
            updates — even when students have no mobile data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ContinueTripCta />
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
            >
              Create host account
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800"
            >
              View demo trip
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <MockPhoneItinerary />
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">The school trip problem</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <li key={p} className="flex gap-2 text-sm text-zinc-700">
                <span className="text-zinc-400">—</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">One hub for the whole trip</h2>
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

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-2xl font-semibold">Built for school trips, not generic travel.</h2>
          <p className="mt-4 text-zinc-600 leading-relaxed">
            Trip Connect is designed around how school trips actually work: teachers make changes,
            students split into groups, parents want reassurance, helpers need contact info, and
            students need clear instructions even when they have no data. No GPS tracking. Role-based
            access. Teacher-controlled publishing. Ideal for overseas trips, camps, exchanges, sports
            tours, and field trips.
          </p>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold">How it works</h2>
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

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-sky-50 to-white p-8 sm:p-10">
            <h2 className="text-2xl font-semibold">Starter Trip — $50 per trip</h2>
            <p className="mt-2 text-sm text-zinc-600">
              One trip, AI builder, student invite, offline access, viewer link, photo gallery,
              emergency phrases — up to 60 participants. School Plan coming later.
            </p>
            <p className="mt-2 text-xs text-zinc-500">Pricing is example only for the prototype.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
              >
                Create host account
              </Link>
              <Link href="/pricing" className="inline-flex h-11 items-center text-sm font-medium text-zinc-700">
                View pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
