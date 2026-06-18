"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TripEyebrow } from "@/components/trip-os/shared/TripEyebrow";
import { TripPrimaryButton } from "@/components/trip-os/shared/TripPrimaryButton";

type AccountPayload = {
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

export function AccountPlanPanel() {
  const [data, setData] = useState<AccountPayload | null>(null);

  useEffect(() => {
    fetch("/api/account/me")
      .then((r) => r.json())
      .then((body) => {
        if (body.account) setData(body);
      })
      .catch(() => null);
  }, []);

  if (!data) return null;

  const isSchool = data.account.accountType === "school";

  return (
    <section className="rounded-2xl bg-zinc-50/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <TripEyebrow>{isSchool ? "School account" : "Personal account"}</TripEyebrow>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">{data.limits.label}</h2>
          {data.account.schoolName ? (
            <p className="text-sm text-zinc-600">{data.account.schoolName}</p>
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">
            {data.billing?.priceDisplay ?? data.limits.priceLabel}
            {data.billing?.status ? ` · ${data.billing.status}` : null}
          </p>
        </div>
        <Link href="/pricing" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          View plans
        </Link>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
          <p className="text-xs text-zinc-500">Active trips</p>
          <p className="font-semibold text-zinc-900">
            {data.usage.activeTrips} / {data.limits.activeTrips}
          </p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
          <p className="text-xs text-zinc-500">Trip history</p>
          <p className="font-semibold text-zinc-900">{data.usage.historyTrips}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
          <p className="text-xs text-zinc-500">Staff accounts</p>
          <p className="font-semibold text-zinc-900">
            {data.usage.staffAccounts} / {data.limits.staffAccounts}
          </p>
        </div>
      </div>
      {data.warnings && data.warnings.length > 0 ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {data.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-zinc-600">
        Students, parents, and viewers do not count as paid staff accounts.
        {!data.limits.aiBuilder ? " AI builder is not included on this plan." : null}
      </p>
      {!isSchool && data.account.plan === "personal_one_time" ? (
        <Link href="/payshare" className="mt-4 inline-block">
          <TripPrimaryButton variant="ghost">Pay with PayShare</TripPrimaryButton>
        </Link>
      ) : null}
      {isSchool ? (
        <p className="mt-3 text-xs text-zinc-500">
          Staff accounts, viewer links, and student invite links are managed per trip.
        </p>
      ) : null}
    </section>
  );
}
