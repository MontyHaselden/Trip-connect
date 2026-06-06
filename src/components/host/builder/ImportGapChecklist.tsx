"use client";

import { useState } from "react";

import type { ImportGap } from "@/lib/host/wizard/analyze-import-gaps";

export function ImportGapChecklist({
  gaps: initialGaps,
  inviteCode,
  days,
  onResolved,
}: {
  gaps: ImportGap[];
  inviteCode: string;
  days: Array<{ id: string; date: string }>;
  onResolved: () => void;
}) {
  const [gaps, setGaps] = useState(initialGaps);
  const [busy, setBusy] = useState<string | null>(null);

  if (!gaps.length) return null;

  async function markFlexible(gap: ImportGap) {
    const day = days.find((d) => d.date === gap.date);
    if (!day) return;

    setBusy(gap.id);
    try {
      const title =
        gap.kind === "missing_hotel"
          ? `Hotel in ${gap.toCity ?? "city"} (TBC)`
          : gap.kind === "city_change_no_transport"
            ? `${gap.fromCity} → ${gap.toCity} (TBC)`
            : gap.kind === "missing_outbound"
              ? "Outbound travel (TBC)"
              : gap.kind === "missing_return"
                ? "Return travel (TBC)"
                : "Details TBC";

      const category =
        gap.kind === "missing_hotel" ? "hotel" : gap.kind.includes("transport") || gap.kind === "city_change_no_transport" ? "travel" : "other";

      const res = await fetch(
        `/api/host/${encodeURIComponent(inviteCode)}/days/${day.id}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            startTime: "09:00",
            category,
            audienceType: "everyone",
            bookingStatus: "not_booked",
          }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      setGaps((prev) => prev.filter((g) => g.id !== gap.id));
      onResolved();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-950">Fill in missing details</p>
      <p className="mt-0.5 text-xs text-amber-800">
        The import could not find everything. Complete each item or mark as not booked yet.
      </p>
      <ul className="mt-3 space-y-2">
        {gaps.map((gap) => (
          <li
            key={gap.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs"
          >
            <span className="text-zinc-800">{gap.message}</span>
            <button
              type="button"
              disabled={busy === gap.id}
              onClick={() => markFlexible(gap)}
              className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 font-medium text-zinc-700"
            >
              {busy === gap.id ? "…" : "Not booked / flexible"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
