"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BillingInfo = {
  status: string;
  trialEndsAt: string | null;
  foundingSchool: boolean;
};

export function BillingTrialBanner() {
  const [billing, setBilling] = useState<BillingInfo | null>(null);

  useEffect(() => {
    fetch("/api/account/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.billing) setBilling(body.billing);
      })
      .catch(() => null);
  }, []);

  if (!billing) return null;

  const trialEnd = billing.trialEndsAt ? new Date(billing.trialEndsAt) : null;
  const trialActive =
    billing.status === "trial" && trialEnd && trialEnd.getTime() > Date.now();

  if (trialActive && trialEnd) {
    return (
      <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-center text-sm text-sky-900">
        Free trial until {trialEnd.toLocaleDateString("en-NZ")}.
        {billing.foundingSchool ? " Founding school pricing ($240 + GST year one) requested." : null}{" "}
        <Link href="/contact" className="font-medium underline">
          Contact us
        </Link>{" "}
        to activate after your trial.
      </div>
    );
  }

  if (billing.status === "trial" && trialEnd) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
        Your trial has ended. You can still edit trips, but live student links are paused until your
        account is activated.{" "}
        <Link href="/contact" className="font-medium underline">
          Contact us
        </Link>
      </div>
    );
  }

  if (billing.status === "past_due") {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-900">
        Invoice overdue — live student access is paused.{" "}
        <Link href="/contact" className="font-medium underline">
          Contact billing
        </Link>
      </div>
    );
  }

  return null;
}
