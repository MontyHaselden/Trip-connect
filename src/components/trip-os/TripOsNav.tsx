"use client";

import type { EngineReadinessStatus, EngineSectionReadiness } from "@/lib/trip-engine/types";

import type { TripOsSection } from "./TripOsWorkspace";
import { TripOsParticipantUpdate } from "./TripOsParticipantUpdate";

const SECTIONS: Array<{ id: TripOsSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "ingest", label: "AI / Import" },
  { id: "map", label: "Map" },
  { id: "locations", label: "Locations" },
  { id: "transport", label: "Transport" },
  { id: "accommodation", label: "Stays" },
  { id: "activities", label: "Activities" },
  { id: "participants", label: "Users" },
  { id: "join-links", label: "Join links" },
  { id: "bookings", label: "Bookings" },
  { id: "finance", label: "Finance" },
  { id: "participant-view", label: "Participant view" },
];

function showStatus(status: EngineReadinessStatus, calmNav: boolean): boolean {
  if (calmNav) return status === "complete" || status === "mostly_complete";
  return status !== "idle";
}

function statusDot(status: EngineReadinessStatus): string {
  switch (status) {
    case "complete":
      return "bg-emerald-400";
    case "mostly_complete":
      return "bg-emerald-400/70";
    case "conflict":
      return "bg-red-400";
    default:
      return "bg-amber-400/80";
  }
}

export function TripOsNav(props: {
  readiness?: EngineSectionReadiness[];
  activeSection?: TripOsSection;
  onSelect?: (id: TripOsSection) => void;
  onBackHome?: () => void;
  saving?: boolean;
  calmNav?: boolean;
  variant?: "board" | "list";
  backLabel?: string;
  tripId?: string;
  inviteCode?: string;
  onParticipantUpdated?: () => void;
  participantUpdateRefreshKey?: number;
}) {
  const variant = props.variant ?? "board";
  const byId = new Map((props.readiness ?? []).map((r) => [r.id, r]));

  return (
    <aside className="trip-os-nav flex w-[15.5rem] shrink-0 flex-col text-indigo-200/60">
      <div className="px-5 pb-4 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300/50">
          Trip OS
        </p>
        {variant === "list" ? (
          <p className="mt-2 text-sm font-medium text-white">Your trips</p>
        ) : null}
      </div>

      {variant === "board" && props.onSelect ? (
        <nav className="flex-1 overflow-y-auto px-3">
          {SECTIONS.map((s) => {
            const meta =
              s.id === "ingest" ||
              s.id === "map" ||
              s.id === "participant-view" ||
              s.id === "participants" ||
              s.id === "join-links"
                ? undefined
                : byId.get(s.id);
            const status = meta?.status ?? "idle";
            const active = props.activeSection === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => props.onSelect!(s.id)}
                className={[
                  "mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition",
                  active
                    ? "bg-violet-500/15 text-white"
                    : "text-indigo-200/60 hover:bg-indigo-400/10 hover:text-indigo-100",
                ].join(" ")}
              >
                <span>{s.label}</span>
                {meta && showStatus(status, props.calmNav ?? false) ? (
                  <span className={["h-1.5 w-1.5 shrink-0 rounded-full", statusDot(status)].join(" ")} />
                ) : null}
              </button>
            );
          })}
        </nav>
      ) : (
        <div className="flex-1" />
      )}

      <div className="px-3 pb-4 pt-2">
        {variant === "board" && props.tripId && props.inviteCode ? (
          <TripOsParticipantUpdate
            tripId={props.tripId}
            inviteCode={props.inviteCode}
            saving={props.saving}
            onUpdated={props.onParticipantUpdated}
            refreshKey={props.participantUpdateRefreshKey}
          />
        ) : null}
        {variant === "board" && props.onBackHome ? (
          <button
            type="button"
            onClick={props.onBackHome}
            className="w-full rounded-xl px-3 py-2.5 text-left text-[13px] text-indigo-300/50 transition hover:bg-indigo-400/10 hover:text-indigo-100"
          >
            ← All trips
          </button>
        ) : null}
        {props.saving ? (
          <p className="mt-2 px-3 text-xs text-indigo-300/40">Saving…</p>
        ) : null}
      </div>
    </aside>
  );
}
