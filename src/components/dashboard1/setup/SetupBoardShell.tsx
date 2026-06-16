"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CalendarContextPanel } from "./CalendarContextPanel";
import { TripCalendar } from "./calendar/TripCalendar";
import { useCalendarInteraction } from "./calendar/useCalendarInteraction";
import { SetupInspector } from "./SetupInspector";
import { SetupNav } from "./SetupNav";
import { useSetupEngine } from "./useSetupEngine";
import type { MiddleView } from "./calendar/useCalendarInteraction";

export function SetupBoardShell(props: { tripId: string }) {
  const router = useRouter();
  const engine = useSetupEngine(props.tripId);
  const [middleView, setMiddleView] = useState<MiddleView>("section");

  useEffect(() => {
    void engine.load();
  }, [engine.load]);

  const groupId = engine.activeGroupId || engine.data?.graph.mainGroupId || "";

  const calendar = useCalendarInteraction({
    graph: engine.data?.graph ?? null,
    renderModel: engine.data?.calendarRenderModel ?? null,
    groupId,
    onDispatch: engine.dispatch,
    onOpenDayView: () => setMiddleView("day"),
    onOpenSectionView: () => setMiddleView("section"),
  });

  const handleNavSelect = useCallback(
    (section: Parameters<typeof engine.setActiveSection>[0]) => {
      calendar.clearSelection();
      engine.setActiveSection(section);
    },
    [calendar, engine],
  );

  if (engine.loading || !engine.data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-600">Loading setup engine…</p>
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
          <p className="text-xs text-zinc-500">Trip setup</p>
        </div>
        {engine.error ? <p className="text-sm text-red-700">{engine.error}</p> : null}
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SetupNav
          readiness={readiness}
          activeSection={engine.activeSection}
          onSelect={handleNavSelect}
          onBackHome={() => router.push("/dashboard")}
          saving={engine.saving}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          {middleView === "day" && calendar.selection.rangeStart ? (
            <CalendarContextPanel
              graph={graph}
              groupId={activeGroupId}
              model={calendarRenderModel}
              selection={calendar.selection}
              conflicts={conflicts}
              onDispatch={engine.dispatch}
              onClearSelection={calendar.clearSelection}
            />
          ) : (
            <SetupInspector
              section={engine.activeSection}
              graph={graph}
              groupId={activeGroupId}
              tripId={props.tripId}
              selectedDay={selectedDay}
              warnings={warnings}
              conflicts={conflicts}
              onDispatch={engine.dispatch}
            />
          )}
        </main>
        <aside className="flex min-h-0 w-[min(42rem,48vw)] min-w-[320px] shrink-0 flex-col overflow-hidden border-l border-zinc-200">
          <TripCalendar
            model={calendarRenderModel}
            selection={calendar.selection}
            onDayClick={calendar.onDayClick}
            onBoundaryMove={(id, delta) => void calendar.commitBoundaryMove(id, delta)}
            onBoundaryClick={(b) => calendar.selectTransferDay(b.date)}
            onTransportCorridorClick={(date) =>
              calendar.onDayClick(date, undefined, { transportClick: true })
            }
            pendingFillHalf={calendar.pendingFillHalf}
            scrollAnchorDate={calendar.scrollAnchorDate}
            pinnedScrollDate={calendar.pinnedScrollDate}
            headerAside={groupSelector}
            statusLine={calendar.statusLine}
          />
        </aside>
      </div>
    </div>
  );
}
