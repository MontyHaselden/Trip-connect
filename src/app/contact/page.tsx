import Link from "next/link";

import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DEFAULT_SUPPORT_EMAIL, PRODUCT_NAME } from "@/lib/brand";

export default function ContactPage() {
  return (
    <MarketingShell active="contact">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
        <p className="mt-3 text-zinc-600">
          Founding schools, demos, billing, and support — we&apos;re a small team and reply within
          one business day.
        </p>

        <div className="mt-10 space-y-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <div>
            <h2 className="font-semibold">Email</h2>
            <p className="mt-2 text-sm text-zinc-600">
              <a
                href={`mailto:${DEFAULT_SUPPORT_EMAIL}`}
                className="font-medium text-violet-700 hover:underline"
              >
                {DEFAULT_SUPPORT_EMAIL}
              </a>
            </p>
          </div>

          <div>
            <h2 className="font-semibold">Book a demo / setup call</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Email us with your school name, trip dates, and how many staff will use {PRODUCT_NAME}.
              We can walk through setup on a video call. Optional guided setup is available (from $50
              NZD) once you&apos;re ready — invoiced manually, no card required at signup.
            </p>
          </div>

          <div>
            <h2 className="font-semibold">Founding school pricing</h2>
            <p className="mt-2 text-sm text-zinc-600">
              The first 15 founding schools can lock in $240 NZD + GST for year one (normally $400
              NZD + GST per year). Mention &quot;founding school&quot; in your email or tick the box
              when you{" "}
              <Link href="/signup?type=school" className="text-violet-700 hover:underline">
                start a free trial
              </Link>
              .
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          Online contact form coming soon — email is the fastest way to reach us today.
        </p>
      </div>
    </MarketingShell>
  );
}
