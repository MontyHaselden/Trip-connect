"use client";

import type { EngineReadinessStatus, EngineSectionReadiness } from "@/lib/trip-engine/types";

import type { TripOsSection } from "./TripOsWorkspace";
import { TripOsParticipantUpdate } from "./TripOsParticipantUpdate";
import { TRIP_OS_AI_IMPORT_ENABLED } from "@/lib/trip-os/feature-flags";

const SECTIONS: Array<{ id: TripOsSection; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "ingest", label: "AI / Import" },
  { id: "map", label: "Map" },
  { id: "locations", label: "Locations" },
  { id: "transport", label: "Transport" },
  { id: "accommodation", label: "Accommodation" },
  { id: "activities", label: "Activities" },
  { id: "participants", label: "Users" },
  { id: "join-links", label: "Join link" },
  { id: "bookings", label: "Bookings" },
  { id: "finance", label: "Finance" },
  { id: "participant-view", label: "Participant view" },
];

function showStatus(status: EngineReadinessStatus, calmNav: boolean): boolean {
  if (calmNav) return status === "complete" || status === "mostly_complete";
  return status !== "idle";
}

function isActionableStatus(status: EngineReadinessStatus): boolean {
  return status === "conflict" || status === "warning";
}

export function TripOsNav(props: {
  readiness?: EngineSectionReadiness[];
  activeSection?: TripOsSection;
  onSelect?: (id: TripOsSection) => void;
  onReadinessIndicator?: (id: TripOsSection, meta: EngineSectionReadiness) => void;
  onBackHome?: () => void;
  saving?: boolean;
  calmNav?: boolean;
  variant?: "board" | "list";
  backLabel?: string;
  schoolName?: string | null;
  tripId?: string;
  inviteCode?: string;
  onParticipantUpdated?: () => void;
  participantUpdateRefreshKey?: number;
}) {
  const variant = props.variant ?? "board";
  const byId = new Map((props.readiness ?? []).map((r) => [r.id, r]));
  const navSections = TRIP_OS_AI_IMPORT_ENABLED
    ? SECTIONS
    : SECTIONS.filter((s) => s.id !== "ingest");

  return (
    <aside className="trip-os-nav flex w-[15.5rem] shrink-0 flex-col text-indigo-200/60">
      <div className="px-5 pb-4 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300/50">
          Trip OS
        </p>
        {variant === "list" ? (
          <div className="mt-3">
            <p className="text-sm font-medium text-white">Dashboard</p>
            {props.schoolName ? (
              <p className="mt-1 truncate text-xs text-indigo-200/70">{props.schoolName}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {variant === "board" && props.onSelect ? (
        <nav className="flex-1 overflow-y-auto px-3">
          {navSections.map((s) => {
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
            const show = meta && showStatus(status, props.calmNav ?? false);
            const actionable = meta && isActionableStatus(status) && Boolean(meta.message);

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => props.onSelect!(s.id)}
                title={meta?.message}
                className={[
                  "mb-0.5 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition",
                  active
                    ? "bg-violet-500/15 text-white"
                    : "text-indigo-200/60 hover:bg-indigo-400/10 hover:text-indigo-100",
                ].join(" ")}
              >
                <span>{s.label}</span>
                {show ? (
                  actionable && props.onReadinessIndicator ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onReadinessIndicator!(s.id, meta);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          props.onReadinessIndicator!(s.id, meta);
                        }
                      }}
                      title={meta.message ?? "Needs attention"}
                      className={[
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[11px] font-bold leading-none",
                        status === "conflict"
                          ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                          : "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30",
                      ].join(" ")}
                    >
                      !
                    </span>
                  ) : status === "complete" || status === "mostly_complete" ? (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  ) : (
                    <span
                      className={[
                        "flex h-4 w-4 shrink-0 items-center justify-center text-[11px] font-bold leading-none",
                        status === "conflict" ? "text-red-300" : "text-amber-200",
                      ].join(" ")}
                    >
                      !
                    </span>
                  )
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
