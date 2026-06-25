import Link from "next/link";

import {
  countFoundingSchools,
} from "@/lib/billing/subscriptions";
import { getFoundingSchoolMaxSlots, getGstSettings } from "@/lib/billing/settings";
import { formatPublicPrice } from "@/lib/billing/gst";
import {
  FOUNDING_SCHOOL_PRICE_CENTS,
  NORMAL_SCHOOL_PRICE_CENTS,
  TRIAL_DAYS,
} from "@/lib/billing/launch-pricing";
import { getPublicPlans } from "@/lib/plans/plans-db";

export async function LaunchSchoolPricing() {
  const [gst, foundingUsed, foundingMax, plans] = await Promise.all([
    getGstSettings(),
    countFoundingSchools(),
    getFoundingSchoolMaxSlots(),
    getPublicPlans(),
  ]);

  const schoolPlan = plans.find((p) => p.code === "school_pro_plus") ?? plans[0];
  const foundingSlotsLeft = Math.max(0, foundingMax - foundingUsed);

  const normal = formatPublicPrice({
    basePriceCents: NORMAL_SCHOOL_PRICE_CENTS,
    billingPeriod: "year",
    settings: gst,
  });
  const founding = formatPublicPrice({
    basePriceCents: FOUNDING_SCHOOL_PRICE_CENTS,
    billingPeriod: "year",
    settings: gst,
  });

  return (
    <section className="py-8">
      <div className="mx-auto max-w-6xl px-5">
        {foundingSlotsLeft > 0 ? (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <p className="font-semibold">Founding school offer — {foundingSlotsLeft} of {foundingMax} places left</p>
            <p className="mt-1 text-amber-900/90">
              Lock in <strong>{founding.display}</strong> for your first year (normally {normal.display}).
              Request founding pricing at signup or{" "}
              <Link href="/contact" className="font-medium underline">
                contact us
              </Link>
              .
            </p>
          </div>
        ) : null}

        <div className="mx-auto max-w-lg">
          <div className="flex flex-col rounded-2xl border-2 border-zinc-900 bg-white p-8 shadow-md">
            <span className="mb-2 w-fit rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
              School plan
            </span>
            <h2 className="text-2xl font-semibold">{schoolPlan?.name ?? "School plan"}</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {schoolPlan?.description ??
                "Full platform for international departments and school trip leaders."}
            </p>
            <p className="mt-6">
              <span className="text-4xl font-semibold">{normal.display.replace(/ \/ year$/, "")}</span>
              <span className="text-lg text-zinc-600">/year</span>
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {TRIAL_DAYS}-day free trial · GST applies if we are GST registered · invoiced annually
            </p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-700">
              {(schoolPlan?.features ?? []).slice(0, 8).map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-sky-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/signup?type=school"
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-medium text-white"
            >
              Start free trial
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-sm text-zinc-600">
          Optional guided setup call (from $50 NZD) can be arranged after signup — we&apos;ll invoice
          manually. No card required to start your trial.
        </p>
      </div>
    </section>
  );
}
