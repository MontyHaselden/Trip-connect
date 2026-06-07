"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const EDITABLE_KEYS = [
  "gst_enabled",
  "gst_rate",
  "gst_display_mode",
  "founding_school_max_slots",
  "enforcement_mode",
  "maintenance_mode",
  "xero_enabled",
  "payshare_enabled",
] as const;

export function SettingsEditor(props: {
  settings: Record<string, string | number | boolean | null>;
}) {
  const router = useRouter();
  const [values, setValues] = useState(props.settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, string | number | boolean | null> = {};
      for (const key of EDITABLE_KEYS) {
        payload[key] = values[key] ?? null;
      }
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settings: payload }),
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

  return (
    <div className="max-w-lg space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {EDITABLE_KEYS.map((key) => (
        <label key={key} className="block text-sm">
          <span className="font-medium text-zinc-700">{key}</span>
          <input
            value={String(values[key] ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              let val: string | number | boolean | null = raw;
              if (raw === "true") val = true;
              else if (raw === "false") val = false;
              else if (raw === "null" || raw === "") val = null;
              else if (!Number.isNaN(Number(raw)) && key.includes("rate") || key.includes("slots")) {
                val = Number(raw);
              }
              setValues({ ...values, [key]: val });
            }}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-300 px-3 font-mono text-sm"
          />
        </label>
      ))}
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        Save settings
      </button>
    </div>
  );
}
