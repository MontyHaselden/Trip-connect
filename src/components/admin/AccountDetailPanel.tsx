"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AccountDetailPanelProps = {
  accountId: string;
  plan: string;
  foundingSchool: boolean;
  paused: boolean;
  internalNotes: string | null;
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
  const [internalNotes, setInternalNotes] = useState(props.internalNotes ?? "");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${props.accountId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan,
          foundingSchool,
          paused,
          internalNotes: internalNotes || null,
          overrideAiBuilder: props.overrideAiBuilder,
          overrideViewerLinks: props.overrideViewerLinks,
          overridePhotoGallery: props.overridePhotoGallery,
          overrideActiveTripLimit: props.overrideActiveTripLimit,
          overrideStaffLimit: props.overrideStaffLimit,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Save failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
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
      <label className="block text-sm">
        <span className="font-medium">Plan</span>
        <select
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-2"
        >
          {props.plans.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={foundingSchool} onChange={(e) => setFoundingSchool(e.target.checked)} />
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
        className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        Save changes
      </button>

      <hr className="border-zinc-200" />
      <h3 className="text-sm font-semibold">Price override (ex-GST, NZD)</h3>
      <input
        type="number"
        step="0.01"
        placeholder="250.00"
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
        className="h-10 rounded-lg border border-zinc-300 px-4 text-sm disabled:opacity-60"
      >
        Add price override
      </button>
    </div>
  );
}
