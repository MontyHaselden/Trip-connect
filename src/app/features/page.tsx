import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FEATURES } from "@/components/marketing/marketing-content";

export default function FeaturesPage() {
  return (
    <MarketingShell active="features">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Features</h1>
        <p className="mt-3 max-w-2xl text-zinc-600">
          Everything schools need to replace PDFs, email threads, and scattered updates with one
          live trip hub — built for teacher control, student clarity, and parent reassurance.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.description}</p>
            </article>
          ))}
        </div>
        <Link
          href="/signup?type=school"
          className="mt-10 inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white"
        >
          Create school account
        </Link>
      </div>
    </MarketingShell>
  );
}
