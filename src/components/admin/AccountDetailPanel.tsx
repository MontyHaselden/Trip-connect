"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AccountDetailPanelProps = {
  accountId: string;
  plan: string;
  foundingSchool: boolean;
  paused: boolean;
  internalNotes: string | null;
  billingStatus: string;
  trialEndsAt: string | null;
  overrideAiBuilder: boolean | null;
  overrideViewerLinks: boolean | null;
  overridePhotoGallery: boolean | null;
  overrideActiveTripLimit: number | null;
  overrideStaffLimit: number | null;
  plans: string[];
};

export function AccountDetailPanel(props: AccountDetailPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState(props.plan);
  const [foundingSchool, setFoundingSchool] = useState(props.foundingSchool);
  const [paused, setPaused] = useState(props.paused);
  const [billingStatus, setBillingStatus] = useState(props.billingStatus);
  const [internalNotes, setInternalNotes] = useState(props.internalNotes ?? "");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${props.accountId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Request failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    await patch({
      plan,
      foundingSchool,
      paused,
      internalNotes: internalNotes || null,
      billingStatus,
      overrideAiBuilder: props.overrideAiBuilder,
      overrideViewerLinks: props.overrideViewerLinks,
      overridePhotoGallery: props.overridePhotoGallery,
      overrideActiveTripLimit: props.overrideActiveTripLimit,
      overrideStaffLimit: props.overrideStaffLimit,
      applyFoundingPricing: foundingSchool && !props.foundingSchool,
    });
  }

  async function addPriceOverride() {
    const cents = Math.round(parseFloat(overridePrice) * 100);
    if (Number.isNaN(cents)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${props.accountId}/price-override`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          basePriceCents: cents,
          reason: overrideReason || undefined,
          lockedPrice: foundingSchool,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Override failed");
      setOverridePrice("");
      setOverrideReason("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="font-semibold text-zinc-900">Actions</h2>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {props.trialEndsAt ? (
        <p className="text-sm text-zinc-600">
          Trial ends: <span className="font-medium">{props.trialEndsAt}</span>
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium">Billing status</span>
        <select
          value={billingStatus}
          onChange={(e) => setBillingStatus(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2"
        >
          {["trial", "active", "manual", "past_due", "expired", "cancelled", "comped"].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ extendTrialDays: 7 })}
          className="h-9 rounded-lg border border-zinc-300 px-3 text-xs font-medium disabled:opacity-60"
        >
          +7 days trial
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ activateAccount: true })}
          className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white disabled:opacity-60"
        >
          Mark active
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void patch({ applyFoundingPricing: true, foundingSchool: true })}
          className="h-9 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-900 disabled:opacity-60"
        >
          Apply founding $240
        </button>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Plan</span>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2"
        >
          {props.plans.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={foundingSchool}
          onChange={(e) => setFoundingSchool(e.target.checked)}
        />
        Founding school
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
        Paused
      </label>
      <label className="block text-sm">
        <span className="font-medium">Internal notes</span>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="h-10 w-full rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        Save changes
      </button>

      <hr className="border-zinc-200" />
      <h3 className="text-sm font-semibold">Price override (ex-GST, NZD)</h3>
      <p className="text-xs text-zinc-500">Normal $400/yr · Founding $240/yr first year</p>
      <input
        type="number"
        step="0.01"
        placeholder="240.00"
        value={overridePrice}
        onChange={(e) => setOverridePrice(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm"
      />
      <input
        type="text"
        placeholder="Reason"
        value={overrideReason}
        onChange={(e) => setOverrideReason(e.target.value)}
        className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm"
      />
      <button
        type="button"
        disabled={busy || !overridePrice}
        onClick={() => void addPriceOverride()}
        className="h-10 w-full rounded-lg border border-zinc-300 px-4 text-sm disabled:opacity-60"
      >
        Add price override
      </button>
    </div>
  );
}
