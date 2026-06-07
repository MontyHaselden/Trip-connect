"use client";

import Link from "next/link";

import type { ImportGap } from "@/lib/host/wizard/analyze-import-gaps";

export function TripGapsPanel({
  gaps,
  tripId,
}: {
  gaps: ImportGap[];
  tripId: string;
}) {
  if (!gaps.length) return null;

  return (
    <aside className="flex h-full min-h-0 w-full max-w-md shrink-0 flex-col border-l border-zinc-200 bg-white">
      <div className="shrink-0 border-b border-zinc-200 px-5 py-4">
        <h3 className="text-sm font-semibold text-zinc-900">To do</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {gaps.length} item{gaps.length === 1 ? "" : "s"} to finish before publishing.
          The phone preview updates as you fix them in Locations.
        </p>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {gaps.map((gap, index) => {
          const href = gap.date
            ? `/dashboard/trips/${tripId}/locations?date=${encodeURIComponent(gap.date)}`
            : `/dashboard/trips/${tripId}/locations`;
          return (
            <li
              key={gap.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-800"
            >
              <p className="text-xs font-medium text-zinc-400">#{index + 1}</p>
              <p className="mt-1 leading-relaxed">{gap.message}</p>
              <Link
                href={href}
                className="mt-2 inline-flex text-xs font-semibold text-sky-800 hover:text-sky-950"
              >
                Fix in Locations →
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
