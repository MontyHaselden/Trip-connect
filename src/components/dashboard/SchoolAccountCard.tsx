"use client";

import Link from "next/link";

import { TripEyebrow } from "@/components/trip-os/shared/TripEyebrow";

export type SchoolAccountSnapshot = {
  account: {
    accountType: string;
    plan: string;
    schoolName: string | null;
    fullName: string;
    planExpiresAt: string | null;
  };
  limits: {
    label: string;
    staffAccounts: number;
    activeTrips: number;
    groupMax: number | null;
    aiBuilder: boolean;
    schoolTools: boolean;
    priceLabel: string;
  };
  usage: {
    activeTrips: number;
    historyTrips: number;
    staffAccounts: number;
  };
  billing?: {
    status: string;
    priceDisplay: string;
  };
  warnings?: string[];
};

export function SchoolAccountCard(props: { data: SchoolAccountSnapshot }) {
  const { data } = props;
  const isSchool = data.account.accountType === "school";

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <TripEyebrow>{isSchool ? "School account" : "Account"}</TripEyebrow>
          <h2 className="mt-1 text-base font-semibold text-zinc-900">{data.limits.label}</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {data.billing?.priceDisplay ?? data.limits.priceLabel}
            {data.billing?.status ? ` · ${data.billing.status}` : null}
          </p>
        </div>
        <Link
          href="/pricing"
          className="text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          View plans
        </Link>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <dt className="text-xs text-zinc-500">Active trips</dt>
          <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
            {data.usage.activeTrips} / {data.limits.activeTrips}
          </dd>
        </div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <dt className="text-xs text-zinc-500">Trip history</dt>
          <dd className="mt-0.5 text-sm font-semibold text-zinc-900">{data.usage.historyTrips}</dd>
        </div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
          <dt className="text-xs text-zinc-500">Staff accounts</dt>
          <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
            {data.usage.staffAccounts} / {data.limits.staffAccounts}
          </dd>
        </div>
      </dl>

      {data.warnings && data.warnings.length > 0 ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {data.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        Students and parents don&apos;t count toward staff limits. Invite links and roster are
        managed inside each trip.
      </p>
    </section>
  );
}
