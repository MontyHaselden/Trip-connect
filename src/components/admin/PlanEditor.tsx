"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  basePriceCents: number;
  billingPeriod: string;
  staffAccountLimit: number;
  activeTripLimit: number;
  visible: boolean;
  badge: string | null;
  priceDisplay: string;
};

export function PlanEditor(props: { plans: PlanRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<PlanRow>>({});

  function startEdit(plan: PlanRow) {
    setEditing(plan.id);
    setForm(plan);
  }

  async function save(planId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          basePriceCents: form.basePriceCents,
          staffAccountLimit: form.staffAccountLimit,
          activeTripLimit: form.activeTripLimit,
          visible: form.visible,
          badge: form.badge,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Price (ex-GST)</th>
            <th className="px-4 py-3">Public display</th>
            <th className="px-4 py-3">Limits</th>
            <th className="px-4 py-3">Visible</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {props.plans.map((plan) => (
            <tr key={plan.id} className="border-t border-zinc-100">
              <td className="px-4 py-3 font-mono text-xs">{plan.code}</td>
              <td className="px-4 py-3">
                {editing === plan.id ? (
                  <input
                    value={form.name ?? ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-8 w-full rounded border px-2"
                  />
                ) : (
                  plan.name
                )}
              </td>
              <td className="px-4 py-3">
                {editing === plan.id ? (
                  <input
                    type="number"
                    value={(form.basePriceCents ?? 0) / 100}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        basePriceCents: Math.round(parseFloat(e.target.value) * 100),
                      })
                    }
                    className="h-8 w-24 rounded border px-2"
                  />
                ) : (
                  `$${(plan.basePriceCents / 100).toFixed(0)}`
                )}
              </td>
              <td className="px-4 py-3 text-zinc-600">{plan.priceDisplay}</td>
              <td className="px-4 py-3">
                {editing === plan.id ? (
                  <span className="flex gap-1">
                    <input
                      type="number"
                      value={form.staffAccountLimit}
                      onChange={(e) =>
                        setForm({ ...form, staffAccountLimit: parseInt(e.target.value, 10) })
                      }
                      className="h-8 w-14 rounded border px-1"
                      title="Staff"
                    />
                    <input
                      type="number"
                      value={form.activeTripLimit}
                      onChange={(e) =>
                        setForm({ ...form, activeTripLimit: parseInt(e.target.value, 10) })
                      }
                      className="h-8 w-14 rounded border px-1"
                      title="Trips"
                    />
                  </span>
                ) : (
                  `${plan.staffAccountLimit} staff · ${plan.activeTripLimit} trips`
                )}
              </td>
              <td className="px-4 py-3">
                {editing === plan.id ? (
                  <input
                    type="checkbox"
                    checked={form.visible ?? true}
                    onChange={(e) => setForm({ ...form, visible: e.target.checked })}
                  />
                ) : plan.visible ? (
                  "Yes"
                ) : (
                  "No"
                )}
              </td>
              <td className="px-4 py-3">
                {editing === plan.id ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void save(plan.id)}
                    className="text-sky-700 underline"
                  >
                    Save
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(plan)}
                    className="text-sky-700 underline"
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
