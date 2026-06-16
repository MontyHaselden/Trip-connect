"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { tripOsHomePath } from "@/lib/trip-os/paths";

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

  useEffect(() => {
    void engine.load();
  }, [engine.load]);

  const groupId = engine.activeGroupId || engine.data?.graph.mainGroupId || "";
  const renderModel = engine.data?.calendarRenderModel ?? null;
  const initialAnchor = renderModel?.scrollAnchorDate ?? "";

  const { scrollRef, saveScrollPosition } = useCalendarScroll(props.tripId, initialAnchor);

  const calendar = useCalendarSelection({
    graph: engine.data?.graph ?? null,
    renderModel,
    groupId,
    onDispatch: engine.dispatch,
    onOpenDayView: () => setMiddleView("day"),
    onOpenSectionView: () => setMiddleView("section"),
    saveScrollPosition,
  });

  const handleNavSelect = useCallback(
    (section: TripOsSection) => {
      calendar.clearSelection();
      setActiveSection(section);
      setMiddleView("section");
    },
    [calendar],
  );

  if (engine.loading || !engine.data) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-sm text-zinc-600">Loading trip engine…</p>
      </div>
    );
  }

  const { graph, calendarProjection, calendarRenderModel, readiness, warnings, conflicts } =
    engine.data;
  const activeGroupId = engine.activeGroupId || graph.mainGroupId;

  const selectedDay =
    calendar.selection.rangeStart
      ? (calendarProjection.days.find((d) => d.date === calendar.selection.rangeStart) ?? null)
      : null;

  const groupSelector = (
    <select
      value={activeGroupId}
      onChange={(e) => void engine.switchGroup(e.target.value)}
      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
    >
      {graph.groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-2">
        <div>
          <p className="text-sm font-semibold">{graph.basics.name || "New trip"}</p>
          <p className="text-xs text-zinc-500">Trip operating system</p>
        </div>
        {engine.error ? <p className="text-sm text-red-700">{engine.error}</p> : null}
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <TripOsNav
          readiness={readiness}
          activeSection={activeSection}
          onSelect={handleNavSelect}
          onBackHome={() => router.push(tripOsHomePath())}
          saving={engine.saving}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {middleView === "day" && calendar.selection.rangeStart ? (
            <DayContextPanel
              graph={graph}
              groupId={activeGroupId}
              model={calendarRenderModel}
              selection={calendar.selection}
              conflicts={conflicts}
              saving={engine.saving}
              error={engine.error}
              onDispatch={engine.dispatch}
              onClearSelection={calendar.clearSelection}
            />
          ) : (
            <TripOsWorkspace
              section={activeSection}
              graph={graph}
              groupId={activeGroupId}
              tripId={props.tripId}
              readiness={readiness}
              selectedDay={selectedDay}
              warnings={warnings}
              conflicts={conflicts}
              saving={engine.saving}
              onDispatch={engine.dispatch}
              onNavigateSection={handleNavSelect}
              onReload={() => void engine.load()}
            />
          )}
        </main>
        <aside className="flex min-h-0 w-[min(42rem,48vw)] min-w-[320px] shrink-0 flex-col overflow-hidden border-l border-zinc-200">
          <InteractiveTripCalendar
            model={calendarRenderModel}
            selection={calendar.selection}
            onDayClick={calendar.onDayClick}
            onTransportCorridorClick={(date) =>
              calendar.onDayClick(date, undefined, { transportClick: true })
            }
            pendingFillHalf={calendar.pendingFillHalf}
            scrollRef={scrollRef}
            headerAside={groupSelector}
            statusLine={calendar.statusLine}
          />
        </aside>
      </div>
    </div>
  );
}
