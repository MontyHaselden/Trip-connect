"use client";

import type { EngineReadinessStatus, EngineSectionReadiness } from "@/lib/trip-engine/types";

import type { TripOsSection } from "./TripOsWorkspace";

const SECTIONS: Array<{ id: TripOsSection; label: string; advanced?: boolean }> = [
  { id: "overview", label: "Overview" },
  { id: "ingest", label: "AI / Import" },
  { id: "map", label: "Map" },
  { id: "locations", label: "Locations", advanced: true },
  { id: "accommodation", label: "Accommodation", advanced: true },
  { id: "transport", label: "Transport", advanced: true },
  { id: "activities", label: "Activities", advanced: true },
  { id: "groups", label: "Groups", advanced: true },
  { id: "bookings", label: "Bookings" },
];

function statusIcon(status: EngineReadinessStatus): string {
  switch (status) {
    case "complete":
      return "✓";
    case "mostly_complete":
      return "◐";
    case "warning":
      return "!";
    case "question":
      return "?";
    case "conflict":
      return "✕";
    default:
      return "·";
  }
}

function statusClass(status: EngineReadinessStatus): string {
  switch (status) {
    case "complete":
      return "text-emerald-600";
    case "mostly_complete":
    case "warning":
      return "text-amber-600";
    case "question":
      return "text-amber-700";
    case "conflict":
      return "text-red-600";
    default:
      return "text-zinc-400";
  }
}

export function TripOsNav(props: {
  readiness: EngineSectionReadiness[];
  activeSection: TripOsSection;
  onSelect: (id: TripOsSection) => void;
  onBackHome: () => void;
  saving: boolean;
}) {
  const byId = new Map(props.readiness.map((r) => [r.id, r]));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 px-4 py-3">
        <p className="text-sm font-semibold">Trip OS</p>
        <p className="text-xs text-zinc-500">Graph + projections</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {SECTIONS.map((s) => {
          const meta =
            s.id === "ingest" || s.id === "map" ? undefined : byId.get(s.id);
          const status = meta?.status ?? "idle";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => props.onSelect(s.id)}
              className={[
                "mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                props.activeSection === s.id ? "bg-white shadow-sm" : "hover:bg-white/70",
              ].join(" ")}
            >
              <span>
                {s.label}
                {s.advanced ? (
                  <span className="ml-1 text-[10px] text-zinc-400">bulk</span>
                ) : null}
              </span>
              {meta ? (
                <span className={["text-xs font-bold", statusClass(status)].join(" ")}>
                  {statusIcon(status)}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-3">
        <button
          type="button"
          onClick={props.onBackHome}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-white"
        >
          Back to trips
        </button>
        {props.saving ? (
          <p className="mt-2 px-3 text-xs text-zinc-500">Saving…</p>
        ) : null}
      </div>
    </aside>
  );
}
