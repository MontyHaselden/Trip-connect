"use client";

import type { SetupSectionId } from "@/lib/host/setup/types";
import type { EngineReadinessStatus, EngineSectionReadiness } from "@/lib/trip-engine/types";

const SECTIONS: Array<{ id: SetupSectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "locations", label: "Locations" },
  { id: "accommodation", label: "Accommodation" },
  { id: "transport", label: "Transport" },
  { id: "activities", label: "Activities" },
  { id: "groups", label: "Groups" },
  { id: "participants", label: "Participants" },
  { id: "bookings", label: "Bookings" },
  { id: "emergency", label: "Emergency" },
  { id: "photos_viewers", label: "Photos" },
  { id: "publish", label: "Publish" },
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
      return "text-amber-600";
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

export function SetupNav(props: {
  readiness: EngineSectionReadiness[];
  activeSection: SetupSectionId;
  onSelect: (id: SetupSectionId) => void;
  onBackHome: () => void;
  saving: boolean;
}) {
  const byId = new Map(props.readiness.map((r) => [r.id, r]));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 px-4 py-3">
        <p className="text-sm font-semibold">Setup</p>
        <p className="text-xs text-zinc-500">Trip engine</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {SECTIONS.map((s) => {
          const meta = byId.get(s.id);
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
              <span>{s.label}</span>
              <span className={["text-xs font-bold", statusClass(status)].join(" ")}>
                {statusIcon(status)}
              </span>
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
