"use client";

import type { OverviewSummarySnapshot } from "@/lib/host/setup/overview-content";

export function TripOverviewSections(props: { snapshot: OverviewSummarySnapshot }) {
  const { stats, sections } = props.snapshot;
  const hasStats = Boolean(stats.dates || stats.locations);
  if (!hasStats && sections.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-5 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          In this trip
        </h3>
      </div>

      {hasStats ? (
        <div className="grid gap-px bg-zinc-100 sm:grid-cols-2">
          {stats.dates ? (
            <div className="bg-white px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Dates
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{stats.dates}</p>
            </div>
          ) : null}
          {stats.locations ? (
            <div className="bg-white px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Locations
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{stats.locations}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {sections.map((section, index) => (
        <div
          key={section.id}
          className={[
            "px-5 py-4",
            index > 0 || hasStats ? "border-t border-zinc-100" : "",
          ].join(" ")}
        >
          <h4 className="text-xs font-semibold text-zinc-700">{section.title}</h4>
          <ul className="mt-3 space-y-2">
            {section.items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3.5 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900" title={item.title}>
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{item.detail}</p>
                  </div>
                  {item.badge ? (
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 ring-1 ring-zinc-200">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
