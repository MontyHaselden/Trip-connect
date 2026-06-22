"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  editGroupIdForLens,
  type CalendarLens,
} from "@/lib/trip-engine/person-lens";
import { tripOsHomePath } from "@/lib/trip-os/paths";

import { graphToSetupState } from "@/lib/trip-engine/adapters";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { isTripWelcomeState } from "@/lib/host/setup/overview-content";

import { CalendarPersonLens } from "./calendar/CalendarPersonLens";
import { InteractiveTripCalendar } from "./calendar/InteractiveTripCalendar";
import { useCalendarScroll } from "./calendar/useCalendarScroll";
import { useCalendarSelection } from "./calendar/useCalendarSelection";
import { DayContextPanel } from "./context/DayContextPanel";
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
  const [calendarLens, setCalendarLens] = useState<CalendarLens>({ kind: "whole_group" });
  const [financeHint, setFinanceHint] = useState<string | null>(null);
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

  const dispatchWithPreviewRefresh = useCallback(
    async (commands: TripCommand[]) => {
      const ok = await engine.dispatch(commands);
      if (ok) {
        scheduleParticipantPreviewRefresh();
        if (
          commands.some((c) =>
            ["paintDayRange", "setDayPlaces", "clearDayRange", "addStay", "removeStay", "addActivity", "removeActivity"].includes(c.type),
          )
        ) {
          setFinanceHint("Trip plan changed — finance allocations may have updated.");
        }
      }
      return ok;
    },
    [engine.dispatch, scheduleParticipantPreviewRefresh],
  );

  useEffect(() => {
    void engine.load();
  }, [props.tripId]); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only initial load

  const groupId = engine.activeGroupId || engine.data?.graph.mainGroupId || "";
  const renderModel = engine.data?.calendarRenderModel ?? null;

  const { scrollRef, saveScrollPosition } = useCalendarScroll();

  const calendar = useCalendarSelection({
    graph: engine.data?.graph ?? null,
    renderModel,
    groupId,
    onDispatch: dispatchWithPreviewRefresh,
    onOpenDayView: () => setMiddleView("day"),
    onOpenSectionView: () => setMiddleView("section"),
    saveScrollPosition,
  });

  const handleNavSelect = useCallback(
    (section: TripOsSection) => {
      calendar.clearSelection();
      const resolved = section;
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

  if (!engine.data && engine.loading) {
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
          <main className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-sm text-zinc-600">Loading trip engine…</p>
          </main>
        </div>
      </div>
    );
  }

  if (!engine.data) {
    return (
      <div className="trip-os flex h-dvh min-h-0 flex-col bg-white">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <TripOsNav
            activeSection={activeSection}
            onSelect={handleNavSelect}
            onBackHome={() => router.push(tripOsHomePath())}
            tripId={props.tripId}
          />
          <main className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-sm text-red-600">{engine.error || "Failed to load trip."}</p>
          </main>
        </div>
      </div>
    );
  }

  const { graph, calendarProjection, calendarRenderModel, readiness, warnings, conflicts, rosterSummary, costLedger } =
    engine.data;
  const activeGroupId = engine.activeGroupId || graph.mainGroupId;
  const calmNav = isTripWelcomeState(graphToSetupState(graph));

  const selectedDay =
    calendar.selection.rangeStart
      ? (calendarProjection.days.find((d) => d.date === calendar.selection.rangeStart) ?? null)
      : null;

  const hideCalendar = activeSection === "finance" || activeSection === "participant-view";
  const fullWidthMain = hideCalendar;

  const groupSelector = (
    <CalendarPersonLens
      graph={graph}
      roster={rosterSummary}
      lens={calendarLens}
      activeGroupId={activeGroupId}
      onLensChange={setCalendarLens}
      onDispatch={dispatchWithPreviewRefresh}
      saving={engine.saving || engine.refreshing}
      onSwitchGroup={(gid) => void engine.switchGroup(gid)}
      onSwitchToPerson={(participantId) => {
        const g = engine.data?.graph;
        const roster = engine.data?.rosterSummary;
        if (!g || !roster) return;
        const gid = editGroupIdForLens(
          g,
          { kind: "person", participantId },
          roster,
        );
        void engine.switchGroup(gid);
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
            fullWidthMain
              ? "flex min-h-0 flex-col overflow-hidden p-0"
              : "overflow-y-auto px-8 py-8",
            activeSection === "ingest" && middleView === "section" && !fullWidthMain
              ? "flex min-h-0 flex-col overflow-hidden"
              : "",
          ].join(" ")}
        >
          {middleView === "day" && calendar.selection.rangeStart ? (
            <DayContextPanel
              tripId={props.tripId}
              graph={graph}
              groupId={activeGroupId}
              model={calendarRenderModel}
              selection={calendar.selection}
              conflicts={conflicts}
              rosterSummary={rosterSummary}
              saving={engine.saving}
              error={engine.error}
              onDispatch={dispatchWithPreviewRefresh}
              onClearSelection={calendar.clearSelection}
              onReload={() => void engine.load(undefined, { silent: true })}
            />
          ) : (
            <TripOsWorkspace
              section={activeSection}
              graph={graph}
              groupId={activeGroupId}
              tripId={props.tripId}
              inviteCode={engine.data.inviteCode}
              readiness={readiness}
              selectedDay={selectedDay}
              warnings={warnings}
              conflicts={conflicts}
              saving={engine.saving}
              onDispatch={dispatchWithPreviewRefresh}
              onNavigateSection={handleNavSelect}
              onReload={() => void engine.load(undefined, { silent: true })}
              onRosterChanged={handleRosterChanged}
              participantViewRefreshKey={participantViewRefreshKey}
              rosterSummary={rosterSummary}
              costLedger={costLedger}
              onCostsAction={engine.patchCosts}
            />
          )}
        </main>
        {!hideCalendar ? (
        <aside className="flex min-h-0 w-[min(42rem,48vw)] min-w-[320px] shrink-0 flex-col overflow-hidden bg-white shadow-[inset_1px_0_0_0_rgb(0_0_0/0.04)]">
          <InteractiveTripCalendar
            tripId={props.tripId}
            model={calendarRenderModel}
            selection={calendar.selection}
            onDayClick={calendar.onDayClick}
            pendingFillHalf={calendar.pendingFillHalf}
            scrollRef={scrollRef}
            onClearSelection={calendar.clearSelection}
            headerAside={groupSelector}
            statusLine={
              financeHint
                ? `${calendar.statusLine} · ${financeHint}`
                : calendar.statusLine
            }
          />
        </aside>
        ) : null}
      </div>
    </div>
  );
}
