"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildTripAdminProjection } from "@/lib/trip-admin/build-admin-projection";
import { buildCalendarEditContext } from "@/lib/trip-admin/list-adapters";
import {
  editGroupIdForLens,
  normalizeCalendarLens,
  type CalendarLens,
} from "@/lib/trip-engine/person-lens";
import { expandCommandsForCalendarLens } from "@/lib/trip-engine/calendar-lens-dispatch";
import {
  clearOversizedTripLocalDraft,
  clearTripLocalDraft,
  mergeTripLocalDraft,
  readTripLocalDraft,
} from "@/lib/trip-os/local-draft";
import { tripOsHomePath } from "@/lib/trip-os/paths";
import { calendarViewForLens } from "@/lib/trip-os/calendar-view-for-lens";
import { TRIP_OS_AI_IMPORT_ENABLED } from "@/lib/trip-os/feature-flags";

import { graphToSetupState } from "@/lib/trip-engine/adapters";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { isTripWelcomeState } from "@/lib/host/setup/overview-content";

import { CalendarPersonLens } from "./calendar/CalendarPersonLens";
import { InteractiveTripCalendar } from "./calendar/InteractiveTripCalendar";
import { useCalendarScroll } from "./calendar/useCalendarScroll";
import { useCalendarSelection } from "./calendar/useCalendarSelection";
import { DayContextPanel } from "./context/DayContextPanel";
import { financeSectionAllocationStatus } from "@/lib/trip-engine/cost-ledger/finance-section-readiness";
import type { FinanceBuiltInSection } from "@/lib/trip-engine/cost-ledger/finance-sections";
import type { EngineSectionReadiness } from "@/lib/trip-engine/types";

import { TripOsNav } from "./TripOsNav";
import { TripOsWorkspace, type TripOsSection } from "./TripOsWorkspace";
import { useTripOsEngine } from "./useTripOsEngine";

type MiddleView = "section" | "day";

export function TripOsBoard(props: { tripId: string }) {
  const router = useRouter();
  const engine = useTripOsEngine(props.tripId);
  const [middleView, setMiddleView] = useState<MiddleView>("section");
  const [activeSection, setActiveSection] = useState<TripOsSection>("overview");
  const [participantViewRefreshKey, setParticipantViewRefreshKey] = useState(0);
  const [financeFocus, setFinanceFocus] = useState<{
    tab: FinanceBuiltInSection;
    lineId?: string;
  } | null>(null);
  const [calendarLens, setCalendarLens] = useState<CalendarLens>({ kind: "whole_group" });
  const calendarLensHydratedRef = useRef(false);
  const activeSectionRef = useRef(activeSection);
  const previewRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  activeSectionRef.current = activeSection;

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
    void engine.load(undefined, { silent: true });
  }, [engine.load, scheduleParticipantPreviewRefresh]);

  const { scrollRef, saveScrollPosition, rememberScrollPosition } = useCalendarScroll();

  const dispatchWithPreviewRefresh = useCallback(
    async (commands: TripCommand[]) => {
      saveScrollPosition();
      const graph = engine.data?.graph;
      const roster = engine.data?.rosterSummary;
      const expanded =
        graph && roster
          ? expandCommandsForCalendarLens(commands, calendarLens, graph, roster)
          : commands;
      const ok = await engine.dispatch(expanded);
      if (ok) {
        scheduleParticipantPreviewRefresh();
      }
      return ok;
    },
    [
      calendarLens,
      engine.data?.graph,
      engine.data?.rosterSummary,
      engine.dispatch,
      scheduleParticipantPreviewRefresh,
      saveScrollPosition,
    ],
  );

  const saveStatusLine =
    engine.saveStatus === "sync_error"
      ? engine.saveError
        ? `Sync pending — ${engine.saveError}`
        : "Sync pending — your edits are saved on this device"
      : null;

  useEffect(() => {
    clearOversizedTripLocalDraft(props.tripId);
    clearTripLocalDraft(props.tripId);
    const timer = window.setTimeout(() => {
      void engine.load(undefined, { skipLocalDraft: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [props.tripId]); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only initial load

  useEffect(() => {
    calendarLensHydratedRef.current = false;
  }, [props.tripId]);

  useEffect(() => {
    if (calendarLensHydratedRef.current) return;
    if (!engine.data) return;
    const draft = readTripLocalDraft(props.tripId);
    if (draft?.calendarLens && engine.data?.graph && engine.data?.rosterSummary) {
      setCalendarLens(
        normalizeCalendarLens(
          draft.calendarLens,
          engine.data.graph,
          engine.data.rosterSummary,
        ),
      );
    }
    calendarLensHydratedRef.current = true;
  }, [props.tripId, engine.data]);

  const handleCalendarLensChange = useCallback(
    (lens: CalendarLens) => {
      setCalendarLens(lens);
      const g = engine.data?.graph;
      const roster = engine.data?.rosterSummary;
      if (!g || !roster) return;
      mergeTripLocalDraft(props.tripId, {
        calendarLens: lens,
        activeGroupId: editGroupIdForLens(g, lens, roster),
      });
    },
    [engine.data?.graph, engine.data?.rosterSummary, props.tripId],
  );

  useEffect(() => {
    if (!TRIP_OS_AI_IMPORT_ENABLED && activeSection === "ingest") {
      setActiveSection("overview");
    }
  }, [activeSection]);

  const graph = engine.data?.graph;
  const rosterSummary = engine.data?.rosterSummary;
  const editGroupId =
    graph && rosterSummary
      ? editGroupIdForLens(graph, calendarLens, rosterSummary)
      : engine.activeGroupId || graph?.mainGroupId || "";

  const calendarView = useMemo(() => {
    if (!engine.data || !graph) return null;
    return calendarViewForLens(graph, editGroupId, {
      calendarRenderModel: engine.data.calendarRenderModel,
      calendarProjection: engine.data.calendarProjection,
      costLedger: engine.data.costLedger,
    });
  }, [engine.data, graph, editGroupId]);

  const adminProjection = useMemo(() => {
    if (!graph || !rosterSummary) return null;
    return engine.data?.adminProjection ?? buildTripAdminProjection(graph, rosterSummary);
  }, [engine.data?.adminProjection, graph, rosterSummary]);

  const calendarEditContext = useMemo(() => {
    if (!graph || !rosterSummary) return null;
    return buildCalendarEditContext(graph, calendarLens, rosterSummary);
  }, [graph, rosterSummary, calendarLens]);

  useEffect(() => {
    if (!graph || !editGroupId) return;
    const modelGroupId = engine.data?.calendarRenderModel.groupId;
    if (editGroupId !== engine.activeGroupId || modelGroupId !== editGroupId) {
      void engine.switchGroup(editGroupId);
    }
  }, [calendarLens, editGroupId, graph, engine.activeGroupId, engine.data?.calendarRenderModel.groupId, engine.switchGroup]);

  useEffect(() => {
    if (!graph) return;
    mergeTripLocalDraft(props.tripId, {
      calendarLens,
      activeGroupId: editGroupId,
    });
  }, [calendarLens, editGroupId, graph, props.tripId]);

  const renderModel = calendarView?.calendarRenderModel ?? null;

  const calendar = useCalendarSelection({
    graph: engine.data?.graph ?? null,
    renderModel,
    groupId: editGroupId,
    onDispatch: dispatchWithPreviewRefresh,
    onOpenDayView: () => setMiddleView("day"),
    onOpenSectionView: () => setMiddleView("section"),
    saveScrollPosition,
  });

  const handleNavSelect = useCallback(
    (section: TripOsSection) => {
      calendar.clearSelection();
      const resolved =
        section === "ingest" && !TRIP_OS_AI_IMPORT_ENABLED ? "overview" : section;
      setActiveSection(resolved);
      setMiddleView("section");
      if (resolved === "participant-view") {
        setParticipantViewRefreshKey((k) => k + 1);
      }
      if (resolved === "finance") {
        void engine.load(undefined, { silent: true });
      }
    },
    [calendar, engine.load],
  );

  const handleOpenFinanceSection = useCallback(
    (tab: FinanceBuiltInSection, lineId?: string) => {
      setFinanceFocus({ tab, lineId });
      calendar.clearSelection();
      setActiveSection("finance");
      setMiddleView("section");
      void engine.load(undefined, { silent: true });
    },
    [calendar, engine.load],
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

  if (!engine.data) {
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
              <p className="text-sm text-zinc-500">
                {engine.refreshing ? "Loading trip…" : "Starting…"}
              </p>
            )}
          </main>
        </div>
      </div>
    );
  }

  const calendarBootstrapping =
    !calendarView ||
    (calendarView.calendarRenderModel.days.length === 0 &&
      calendarView.calendarProjection.days.length === 0 &&
      engine.loadStatus.phase !== "ready");

  const { graph: tripGraph, readiness, warnings, conflicts, rosterSummary: roster, costLedger } =
    engine.data!;
  const calendarRenderModel =
    calendarView?.calendarRenderModel ?? engine.data!.calendarRenderModel;
  const calendarProjection =
    calendarView?.calendarProjection ?? engine.data!.calendarProjection;
  const activeGroupId = editGroupId;
  const calmNav = isTripWelcomeState(graphToSetupState(tripGraph));
  const calendarLensReady =
    calendarRenderModel.groupId === editGroupId && calendarRenderModel.days.length > 0;

  const selectedDay =
    calendar.selection.rangeStart
      ? (calendarProjection.days.find((d) => d.date === calendar.selection.rangeStart) ?? null)
      : null;

  const hideCalendar = activeSection === "finance" || activeSection === "participant-view";
  const fullWidthMain = hideCalendar;
  const mapLayout = activeSection === "map";

  const groupSelector = (
    <CalendarPersonLens
      graph={tripGraph}
      roster={roster}
      lens={calendarLens}
      activeGroupId={activeGroupId}
      onLensChange={handleCalendarLensChange}
      onDispatch={dispatchWithPreviewRefresh}
      saving={engine.saving || engine.refreshing}
      onSwitchToPerson={(participantId) => {
        handleCalendarLensChange({ kind: "person", participantId });
      }}
    />
  );

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
            activeSection === "ingest" && middleView === "section" && !fullWidthMain && !mapLayout
              ? "flex min-h-0 flex-col overflow-hidden"
              : "",
            mapLayout && middleView === "section" ? "px-4 py-4" : "",
          ].join(" ")}
        >
          {middleView === "day" && calendar.selection.rangeStart ? (
            <DayContextPanel
              tripId={props.tripId}
              graph={tripGraph}
              groupId={activeGroupId}
              model={calendarRenderModel}
              selection={calendar.selection}
              conflicts={conflicts}
              rosterSummary={roster}
              costLedger={costLedger}
              saving={engine.saving}
              error={engine.error}
              onDispatch={dispatchWithPreviewRefresh}
              onClearSelection={calendar.clearSelection}
              onSelectStayDateRange={calendar.selectStayDateRange}
              onReload={() => void engine.load(undefined, { silent: true })}
            />
          ) : adminProjection && calendarEditContext ? (
            <TripOsWorkspace
              section={activeSection}
              graph={tripGraph}
              groupId={activeGroupId}
              calendarLens={calendarLens}
              adminProjection={adminProjection}
              calendarEditContext={calendarEditContext}
              tripId={props.tripId}
              inviteCode={engine.data.inviteCode}
              readiness={readiness}
              selectedDay={selectedDay}
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
              calendarSelection={calendar.selection}
              onHighlightDayFromMap={calendar.highlightDayFromMap}
              onGoToDateFromMap={calendar.goToDateFromMap}
            />
          ) : (
            <p className="px-2 py-8 text-center text-sm text-zinc-500">Preparing trip view…</p>
          )}
        </main>
        {!hideCalendar ? (
        <aside className="flex min-h-0 w-[min(42rem,48vw)] min-w-[320px] shrink-0 flex-col overflow-hidden bg-white shadow-[inset_1px_0_0_0_rgb(0_0_0/0.04)]">
          {calendarBootstrapping ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium text-zinc-700">Building calendar…</p>
              <p className="text-xs text-zinc-500">Large trips can take a few seconds.</p>
            </div>
          ) : (
          <InteractiveTripCalendar
            tripId={props.tripId}
            model={calendarRenderModel}
            selection={calendar.selection}
            onDayClick={calendar.onDayClick}
            pendingFillHalf={calendar.pendingFillHalf}
            scrollRef={scrollRef}
            onInitialScroll={rememberScrollPosition}
            onClearSelection={calendar.clearSelection}
            headerAside={groupSelector}
            statusLine={
              saveStatusLine
                ? `${calendar.statusLine} · ${saveStatusLine}`
                : calendar.statusLine
            }
            interactionDisabled={!calendarLensReady || engine.saving || engine.refreshing}
          />
          )}
        </aside>
        ) : null}
      </div>
    </div>
  );
}
