"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildTripAdminProjection } from "@/lib/trip-admin/build-admin-projection";
import { buildCalendarEditContext } from "@/lib/trip-admin/list-adapters";
import type { CalendarLens } from "@/lib/trip-engine/person-lens";
import { prepareCommandsForCalendarLens } from "@/lib/trip-engine/calendar-lens-dispatch";
import {
  clearOversizedTripLocalDraft,
  clearTripLocalDraft,
} from "@/lib/trip-os/local-draft";
import { tripOsHomePath } from "@/lib/trip-os/paths";
import { TRIP_OS_AI_IMPORT_ENABLED } from "@/lib/trip-os/feature-flags";

import { graphToSetupState } from "@/lib/trip-engine/adapters";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { isTripWelcomeState } from "@/lib/host/setup/overview-content";

import { financeSectionAllocationStatus } from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { FinanceBuiltInSection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import type { EngineSectionReadiness } from "@/lib/trip-engine/types";

import { TripOsNav } from "./TripOsNav";
import { TripOsWorkspace, type TripOsSection } from "./TripOsWorkspace";
import { useTripOsEngine } from "./useTripOsEngine";

const WHOLE_GROUP_LENS: CalendarLens = { kind: "whole_group" };

export function TripOsBoard(props: { tripId: string }) {
  const router = useRouter();
  const engine = useTripOsEngine(props.tripId);
  const [activeSection, setActiveSection] = useState<TripOsSection>("overview");
  const [participantViewRefreshKey, setParticipantViewRefreshKey] = useState(0);
  const [financeFocus, setFinanceFocus] = useState<{
    tab: FinanceBuiltInSection;
    lineId?: string;
  } | null>(null);
  const previewRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (previewRefreshTimerRef.current) clearTimeout(previewRefreshTimerRef.current);
    };
  }, []);

  const scheduleParticipantPreviewRefresh = useCallback(() => {
    if (previewRefreshTimerRef.current) clearTimeout(previewRefreshTimerRef.current);
    previewRefreshTimerRef.current = setTimeout(() => {
      setParticipantViewRefreshKey((k) => k + 1);
    }, 300);
  }, []);

  const handleRosterChanged = useCallback(() => {
    scheduleParticipantPreviewRefresh();
    void engine.refreshRosterSummary();
  }, [engine.refreshRosterSummary, scheduleParticipantPreviewRefresh]);

  const dispatchWithPreviewRefresh = useCallback(
    async (commands: TripCommand[]) => {
      const graph = engine.data?.graph;
      const roster = engine.data?.rosterSummary;
      const prepared =
        graph && roster
          ? prepareCommandsForCalendarLens(commands, WHOLE_GROUP_LENS, graph, roster)
          : commands;
      const ok = await engine.dispatch(prepared);
      if (ok) {
        scheduleParticipantPreviewRefresh();
      }
      return ok;
    },
    [
      engine.data?.graph,
      engine.data?.rosterSummary,
      engine.dispatch,
      scheduleParticipantPreviewRefresh,
    ],
  );

  useEffect(() => {
    clearOversizedTripLocalDraft(props.tripId);
    clearTripLocalDraft(props.tripId);
    const timer = window.setTimeout(() => {
      void engine.load(undefined, { skipLocalDraft: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [props.tripId]); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only initial load

  useEffect(() => {
    if (!TRIP_OS_AI_IMPORT_ENABLED && activeSection === "ingest") {
      setActiveSection("overview");
    }
  }, [activeSection]);

  const graph = engine.data?.graph;
  const rosterSummary = engine.data?.rosterSummary;
  const activeGroupId = graph?.mainGroupId ?? engine.activeGroupId ?? "";

  const adminProjection = useMemo(() => {
    if (!graph || !rosterSummary) return null;
    return engine.data?.adminProjection ?? buildTripAdminProjection(graph, rosterSummary);
  }, [engine.data?.adminProjection, graph, rosterSummary]);

  const calendarEditContext = useMemo(() => {
    if (!graph || !rosterSummary) return null;
    return buildCalendarEditContext(graph, WHOLE_GROUP_LENS, rosterSummary);
  }, [graph, rosterSummary]);

  useEffect(() => {
    if (!graph?.mainGroupId) return;
    if (activeGroupId !== engine.activeGroupId) {
      void engine.switchGroup(activeGroupId);
    }
  }, [activeGroupId, engine.activeGroupId, engine.switchGroup, graph?.mainGroupId]);

  const handleNavSelect = useCallback(
    (section: TripOsSection) => {
      const resolved =
        section === "ingest" && !TRIP_OS_AI_IMPORT_ENABLED ? "overview" : section;
      setActiveSection(resolved);
      if (resolved === "participant-view") {
        setParticipantViewRefreshKey((k) => k + 1);
      }
      if (resolved === "finance") {
        void engine.refreshCostLedger();
      }
    },
    [engine.refreshCostLedger],
  );

  const handleOpenFinanceSection = useCallback(
    (tab: FinanceBuiltInSection, lineId?: string) => {
      setFinanceFocus({ tab, lineId });
      setActiveSection("finance");
      void engine.refreshCostLedger();
    },
    [engine.refreshCostLedger],
  );

  const handleReadinessIndicator = useCallback(
    (section: TripOsSection, _meta: EngineSectionReadiness) => {
      const data = engine.data;
      if (!data) {
        handleNavSelect(section);
        return;
      }
      const linked = ["accommodation", "transport", "activities"] as const;
      if ((linked as readonly string[]).includes(section)) {
        const status = financeSectionAllocationStatus(
          section as FinanceBuiltInSection,
          data.costLedger,
          data.graph,
        );
        if (status?.financeOnlyCount) {
          handleNavSelect(section);
          return;
        }
        if (status?.unallocatedCount) {
          setFinanceFocus({ tab: section as FinanceBuiltInSection });
          handleNavSelect("finance");
          return;
        }
        if (status?.tbcCount) {
          setFinanceFocus({ tab: section as FinanceBuiltInSection });
          handleNavSelect("finance");
          return;
        }
      }
      handleNavSelect(section);
    },
    [engine.data, handleNavSelect],
  );

  if (!engine.data || engine.loadStatus.phase !== "ready") {
    const loadMessage =
      engine.loadStatus.message ||
      (engine.refreshing ? "Loading trip…" : "Starting…");
    const loadProgress = engine.loadStatus.progress;

    return (
      <div className="trip-os flex h-dvh min-h-0 flex-col bg-white">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <TripOsNav
            activeSection={activeSection}
            onSelect={handleNavSelect}
            onBackHome={() => router.push(tripOsHomePath())}
            saving={engine.refreshing}
            tripId={props.tripId}
          />
          <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-white px-6">
            {engine.error ? (
              <>
                <p className="max-w-md text-center text-sm text-red-600">{engine.error}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void engine.load(undefined, { forceServer: true, skipLocalDraft: true })}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearTripLocalDraft(props.tripId);
                      void engine.load(undefined, { forceServer: true, skipLocalDraft: true });
                    }}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                  >
                    Clear cache & retry
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-500">{loadMessage}</p>
                {loadProgress > 0 && loadProgress < 100 ? (
                  <div
                    className="h-1 w-48 overflow-hidden rounded-full bg-zinc-100"
                    role="progressbar"
                    aria-valuenow={loadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-violet-500 transition-[width] duration-300"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    );
  }

  const { graph: tripGraph, readiness, warnings, conflicts, rosterSummary: roster, costLedger } =
    engine.data;
  const calmNav = isTripWelcomeState(graphToSetupState(tripGraph));
  const fullWidthMain = activeSection === "finance" || activeSection === "participant-view";
  const mapLayout = activeSection === "map";

  return (
    <div className="trip-os flex h-dvh min-h-0 flex-col bg-white">
      {engine.error ? (
        <div className="shrink-0 bg-red-50 px-4 py-2 text-sm text-red-700">{engine.error}</div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <TripOsNav
          readiness={readiness}
          activeSection={activeSection}
          onSelect={handleNavSelect}
          onReadinessIndicator={handleReadinessIndicator}
          onBackHome={() => router.push(tripOsHomePath())}
          saving={engine.saving || engine.refreshing}
          calmNav={calmNav}
          tripId={props.tripId}
          inviteCode={engine.data.inviteCode}
          onParticipantUpdated={() => void engine.load(undefined, { silent: true })}
          participantUpdateRefreshKey={participantViewRefreshKey}
        />
        <main
          className={[
            "trip-os-workspace min-w-0 flex-1",
            fullWidthMain || mapLayout
              ? "flex min-h-0 flex-col overflow-hidden p-0"
              : "overflow-y-auto px-8 py-8",
            activeSection === "ingest" && !fullWidthMain && !mapLayout
              ? "flex min-h-0 flex-col overflow-hidden"
              : "",
            mapLayout ? "px-4 py-4" : "",
          ].join(" ")}
        >
          {adminProjection && calendarEditContext ? (
            <TripOsWorkspace
              section={activeSection}
              graph={tripGraph}
              groupId={activeGroupId}
              adminProjection={adminProjection}
              calendarEditContext={calendarEditContext}
              tripId={props.tripId}
              inviteCode={engine.data.inviteCode}
              readiness={readiness}
              warnings={warnings}
              conflicts={conflicts}
              saving={engine.saving}
              onDispatch={dispatchWithPreviewRefresh}
              onSwitchGroup={engine.switchGroup}
              onNavigateSection={handleNavSelect}
              onOpenFinanceSection={handleOpenFinanceSection}
              financeFocusTab={financeFocus?.tab ?? null}
              financeFocusLineId={financeFocus?.lineId ?? null}
              onFinanceFocusConsumed={() => setFinanceFocus(null)}
              onReload={() => void engine.load(undefined, { silent: true })}
              onRosterChanged={handleRosterChanged}
              participantViewRefreshKey={participantViewRefreshKey}
              rosterSummary={roster}
              costLedger={costLedger}
              onCostsAction={engine.patchCosts}
              resolveFinanceLineId={engine.resolveFinanceLineId}
            />
          ) : (
            <p className="px-2 py-8 text-center text-sm text-zinc-500">Preparing trip view…</p>
          )}
        </main>
      </div>
    </div>
  );
}
