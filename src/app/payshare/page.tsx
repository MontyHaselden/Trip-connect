"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { MarketingShell } from "@/components/marketing/MarketingShell";

function PayShareContent() {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startPayShare() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/payshare/create-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "personal_one_time" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not start PayShare");
      setMessage(
        `Mock checkout ready. ${body.groupSize} people × $${(body.splitAmountCents / 100).toFixed(0)} = $${(body.amountCents / 100).toFixed(0)} trip package. Real PayShare API coming later.`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-lg px-5 py-16">
        <h1 className="text-2xl font-semibold">Pay with PayShare</h1>
        {welcome ? (
          <p className="mt-2 text-sm text-emerald-800">
            Account created. You can pay now or continue to your dashboard and pay later.
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          Split this $18 one-time trip package with your group using PayShare. Each person can pay
          their share — for example, 6 friends paying $3 each.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-700">
          <li>Available for the Personal One-Time Trip plan</li>
          <li>Useful for friends, families, and small groups</li>
          <li>Powered by PayShare (integration placeholder)</li>
        </ul>
        {message ? (
          <p className="mt-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-zinc-800">{message}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={startPayShare}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Starting…" : "Pay with PayShare"}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-800"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}

export default function PaySharePage() {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-zinc-600">Loading…</p>}>
      <PayShareContent />
    </Suspense>
  );
}
