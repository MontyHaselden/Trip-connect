import Link from "next/link";

import { PRICING_NOTES } from "./marketing-content";
import { getPublicPlans } from "@/lib/plans/plans-db";

function PricingCard(props: {
  name: string;
  price: string;
  period: string;
  bestFor?: string | null;
  validity?: string | null;
  badge?: string | null;
  includes: readonly string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  const { highlighted } = props;
  const priceParts = props.price.split(" + ");
  const mainPrice = priceParts[0] ?? props.price;
  const gstSuffix = priceParts[1] ? ` + ${priceParts[1]}` : "";

  return (
    <div
      className={[
        "flex flex-col rounded-2xl border bg-white p-6",
        highlighted ? "border-2 border-zinc-900 shadow-md" : "border-zinc-200",
      ].join(" ")}
    >
      {props.badge ? (
        <span className="mb-2 w-fit rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
          {props.badge}
        </span>
      ) : null}
      <h3 className="text-lg font-semibold">{props.name}</h3>
      {props.bestFor ? (
        <p className="mt-1 text-sm text-zinc-600">{props.bestFor}</p>
      ) : null}
      {props.validity ? (
        <p className="mt-1 text-xs text-zinc-500">{props.validity}</p>
      ) : null}
      <p className="mt-4">
        <span className="text-3xl font-semibold">{mainPrice}</span>
        {gstSuffix ? <span className="text-lg font-semibold text-zinc-700">{gstSuffix}</span> : null}
        <span className="text-sm text-zinc-600">{props.period}</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2 text-sm text-zinc-700">
        {props.includes.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-sky-600">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href={props.href}
        className={[
          "mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium",
          highlighted
            ? "bg-zinc-900 text-white"
            : "border border-zinc-300 bg-white text-zinc-900",
        ].join(" ")}
      >
        {props.cta}
      </Link>
    </div>
  );
}

function periodLabel(billingPeriod: string): string {
  if (billingPeriod === "once") return "";
  if (billingPeriod === "year") return "/year";
  if (billingPeriod === "month") return "/month";
  return "";
}

function validityLabel(billingPeriod: string): string | null {
  if (billingPeriod === "once") return "Valid for 6 months";
  return null;
}

export async function SchoolPricingSection(props: { showNotes?: boolean }) {
  const plans = await getPublicPlans();
  const schoolPlans = plans.filter((p) => p.accountType === "school");

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-2xl font-semibold">Simple yearly pricing for schools</h2>
        <p className="mt-2 max-w-2xl text-zinc-600">
          No per-student fees. Students, parents, and viewers do not count as paid staff accounts.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {schoolPlans.map((plan) => (
            <PricingCard
              key={plan.code}
              name={plan.name}
              price={plan.priceDisplay.replace(/ \/ year$| \/ month$| once$/, "")}
              period={periodLabel(plan.billingPeriod)}
              bestFor={plan.description}
              badge={plan.badge}
              includes={plan.features}
              cta="Start with this plan"
              href={`/signup?type=school&plan=${plan.code}`}
              highlighted={plan.code === "school_pro"}
            />
          ))}
        </div>
        {props.showNotes ? (
          <div className="mt-8 space-y-2 text-sm text-zinc-600">
            {PRICING_NOTES.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export async function PersonalPricingSection() {
  const plans = await getPublicPlans();
  const personalPlans = plans.filter((p) => p.accountType === "personal");

  return (
    <section className="border-t border-zinc-200 bg-zinc-50/80 py-16">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-2xl font-semibold">Also useful for personal group trips</h2>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Planning a family holiday, friend trip, sports weekend, or group event? Itinerary Live
          also has simple personal options — without school admin tools or per-student pricing.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {personalPlans.map((plan) => (
            <PricingCard
              key={plan.code}
              name={plan.name}
              price={plan.priceDisplay.replace(/ \/ year$| \/ month$| once$/, "")}
              period={periodLabel(plan.billingPeriod)}
              validity={validityLabel(plan.billingPeriod)}
              badge={plan.badge}
              includes={plan.features}
              cta={plan.payshareEnabled ? "Pay with PayShare" : "Start with this plan"}
              href={`/signup?type=personal&plan=${plan.code}`}
            />
          ))}
        </div>
        <p className="mt-6 text-sm text-zinc-600">
          Personal plans do not include student account mode, school admin dashboard, staff/helper
          permissions, or large school group features.
        </p>
      </div>
    </section>
  );
}
