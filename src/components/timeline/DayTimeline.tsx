"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { hostJson } from "@/components/host/shared/host-fetch";
import type { ItineraryItem, RosterSummary } from "@/components/host/itinerary/types";
import {
  findBlockAtPoint,
  layoutTimelineItems,
  mergeLayoutIntoItems,
} from "@/lib/timeline/overlap-layout";
import type { TimelineItemBase } from "@/lib/timeline/types";
import {
  DAY_MINUTES,
  TIMELINE_GUTTER_PX,
  TIMELINE_HEIGHT_PX,
  computeSortOrderMap,
  defaultCreateEndMinutes,
  formatHourLabel,
  isActiveAtNow,
  minutesToTimeHHMMSS,
  minutesToTopPx,
  sortItemsByStartTime,
  timeToMinutes,
} from "@/lib/timeline/time-math";
import type { ItineraryRowItem } from "@/lib/utils/itinerary-item-style";

import { ItemEditSheet } from "./ItemEditSheet";
import { NowLine } from "./NowLine";
import { TimelineBlock } from "./TimelineBlock";
import { useNowLine } from "./useNowLine";
import { useTimelineDrag } from "./useTimelineDrag";

type DayTimelineItem = ItineraryRowItem & TimelineItemBase;

function applyOverrides<T extends TimelineItemBase>(
  items: T[],
  overrides: Map<string, { startMinutes: number; endMinutes: number }>,
): T[] {
  if (!overrides.size) return items;
  return items.map((item) => {
    const o = overrides.get(item.id);
    if (!o) return item;
    return {
      ...item,
      startTime: minutesToTimeHHMMSS(o.startMinutes),
      endTime: minutesToTimeHHMMSS(o.endMinutes),
    };
  });
}

export function DayTimeline(props: {
  mode: "view" | "edit";
  items: DayTimelineItem[];
  dateISO: string;
  tripTimezone: string;
  isViewingToday: boolean;
  mapsOnline?: boolean;
  prepItems?: Array<{ id: string; text: string }>;
  inviteCode?: string;
  dayId?: string;
  roster?: RosterSummary;
  onReload?: () => void;
  onError?: (msg: string) => void;
}) {
  const {
    mode,
    items,
    dateISO,
    tripTimezone,
    isViewingToday,
    mapsOnline = true,
    prepItems = [],
    inviteCode,
    dayId,
    roster,
    onReload,
    onError,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrolledToNowRef = useRef<string | null>(null);
  const dragHappenedRef = useRef(false);

  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [localItems, setLocalItems] = useState(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sortedItems = useMemo(() => sortItemsByStartTime(localItems), [localItems]);

  const nowMinutes = useNowLine({
    dateISO,
    tripTimezone,
    enabled: isViewingToday,
  });

  const api =
    inviteCode && mode === "edit"
      ? `/api/host/${encodeURIComponent(inviteCode)}`
      : null;

  const patchItemTimes = useCallback(
    async (id: string, startMinutes: number, endMinutes: number) => {
      if (!api) return;
      const startTime = minutesToTimeHHMMSS(startMinutes);
      const endTime = minutesToTimeHHMMSS(endMinutes);
      const nextItems = localItems.map((item) =>
        item.id === id ? { ...item, startTime, endTime } : item,
      );
      const sortOrderMap = computeSortOrderMap(nextItems);
      const prevItems = localItems;
      setLocalItems(nextItems);
      try {
        await hostJson(`${api}/items/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            startTime,
            endTime,
            sortOrder: sortOrderMap.get(id),
          }),
        });
        onReload?.();
      } catch (err) {
        setLocalItems(prevItems);
        onError?.(err instanceof Error ? err.message : "Update failed");
        throw err;
      }
    },
    [api, localItems, onError, onReload],
  );

  const {
    draggingId,
    overrides,
    bindMove,
    bindResize,
    clientYToMinutes,
  } = useTimelineDrag({
    enabled: mode === "edit",
    scrollRef,
    canvasRef,
    getItemTimes: (id) => {
      const display = applyOverrides(sortedItems, overrides);
      const layouts = layoutTimelineItems(display);
      const layout = layouts.find((l) => l.id === id);
      if (!layout) return null;
      return {
        startMinutes: layout.startMinutes,
        endMinutes: layout.endMinutes,
      };
    },
    onCommit: patchItemTimes,
    onDragComplete: () => {
      dragHappenedRef.current = true;
    },
  });

  const displayItems = useMemo(
    () => applyOverrides(sortedItems, overrides),
    [sortedItems, overrides],
  );

  const layouts = useMemo(() => layoutTimelineItems(displayItems), [displayItems]);
  const merged = useMemo(
    () => mergeLayoutIntoItems(displayItems, layouts),
    [displayItems, layouts],
  );

  const activeId = useMemo(() => {
    if (nowMinutes == null) return null;
    for (const layout of layouts) {
      if (isActiveAtNow(nowMinutes, layout.startMinutes, layout.endMinutes)) {
        return layout.id;
      }
    }
    return null;
  }, [layouts, nowMinutes]);

  useEffect(() => {
    if (!isViewingToday || nowMinutes == null) return;
    if (scrolledToNowRef.current === dateISO) return;
    const container = scrollRef.current;
    if (!container) return;

    const top = minutesToTopPx(nowMinutes);
    const targetScroll = top - container.clientHeight * 0.35;
    container.scrollTop = Math.max(0, targetScroll);
    scrolledToNowRef.current = dateISO;
  }, [dateISO, isViewingToday, nowMinutes]);

  useEffect(() => {
    scrolledToNowRef.current = null;
  }, [dateISO]);

  const hourMarks = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      topPx: hour * 60 * 2,
      label: formatHourLabel(hour),
    }));
  }, []);

  const quarterMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = 15; m < DAY_MINUTES; m += 15) {
      if (m % 60 === 0) continue;
      marks.push(m);
    }
    return marks;
  }, []);

  async function createItemAt(startMinutes: number) {
    if (!api || !dayId) return;
    const sortedStarts = sortedItems.map((i) => timeToMinutes(i.startTime));
    const endMinutes = defaultCreateEndMinutes(startMinutes, sortedStarts);
    try {
      await hostJson(`${api}/days/${dayId}/items`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startTime: minutesToTimeHHMMSS(startMinutes).slice(0, 5),
          endTime: minutesToTimeHHMMSS(endMinutes).slice(0, 5),
          title: "New activity",
          locationName: null,
          address: null,
          leaveByTime: null,
          transportNote: null,
          bringNote: null,
          hostNote: null,
          audienceType: "everyone",
          audienceId: null,
        }),
      });
      onReload?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function deleteItem(id: string) {
    if (!api || !confirm("Delete this itinerary item?")) return;
    try {
      await hostJson(`${api}/items/${id}`, { method: "DELETE" });
      setEditingItem(null);
      onReload?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function quickAddAtNowOrNine() {
    const start =
      isViewingToday && nowMinutes != null
        ? nowMinutes
        : timeToMinutes("09:00:00");
    await createItemAt(start);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "edit") return;
    if (dragHappenedRef.current) {
      dragHappenedRef.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest("[data-timeline-block]")) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lanePercent = ((e.clientX - rect.left) / rect.width) * 100;
    const minutes = clientYToMinutes(e.clientY);
    if (findBlockAtPoint(layouts, minutes, lanePercent)) return;
    void createItemAt(minutes);
  }

  function openEditSheet(itemId: string) {
    if (mode !== "edit" || !roster) return;
    if (dragHappenedRef.current) {
      dragHappenedRef.current = false;
      return;
    }
    const hostItem = localItems.find((i) => i.id === itemId);
    if (!hostItem) return;
    setEditingItem(hostItem as ItineraryItem);
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {mode === "edit" ? (
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-0.5">
            <p className="text-xs text-zinc-500">
              Drag to move · handles to resize · tap empty space to add
            </p>
            <button
              type="button"
              onClick={() => void quickAddAtNowOrNine()}
              className="shrink-0 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700"
            >
              Add item
            </button>
          </div>
        ) : null}

        <div
          ref={scrollRef}
          className="no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
        >
          <div className="relative flex" style={{ minHeight: TIMELINE_HEIGHT_PX }}>
            <div
              className="relative shrink-0 text-[10px] tabular-nums text-zinc-400"
              style={{ width: TIMELINE_GUTTER_PX, height: TIMELINE_HEIGHT_PX }}
            >
              {hourMarks.map(({ hour, topPx, label }) => (
                <span
                  key={hour}
                  className="absolute right-1 -translate-y-1/2"
                  style={{ top: topPx }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div
              ref={canvasRef}
              className="relative min-w-0 flex-1 border-l border-zinc-200/80"
              style={{ height: TIMELINE_HEIGHT_PX }}
              onClick={handleCanvasClick}
            >
              {hourMarks.map(({ hour, topPx }) => (
                <div
                  key={`h-${hour}`}
                  className="pointer-events-none absolute right-0 left-0 border-t border-zinc-200/90"
                  style={{ top: topPx }}
                />
              ))}
              {quarterMarks.map((m) => (
                <div
                  key={`q-${m}`}
                  className="pointer-events-none absolute right-0 left-0 border-t border-zinc-100"
                  style={{ top: m * 2 }}
                />
              ))}

              {merged.map(({ layout, ...item }) => (
                <div key={item.id} data-timeline-block>
                  <TimelineBlock
                    item={item}
                    layout={layout}
                    tripTimezone={tripTimezone}
                    mapsEnabled={mapsOnline}
                    isActive={item.id === activeId}
                    mode={mode}
                    isDragging={draggingId === item.id}
                    onBlockClick={() => openEditSheet(item.id)}
                    onDragStart={(e) => {
                      dragHappenedRef.current = false;
                      bindMove(item.id, e);
                    }}
                    onResizeStart={(edge, e) => {
                      dragHappenedRef.current = true;
                      bindResize(item.id, edge, e);
                    }}
                  />
                </div>
              ))}

              {nowMinutes != null ? <NowLine nowMinutes={nowMinutes} /> : null}
            </div>
          </div>

          {prepItems.length ? (
            <section className="mt-6 border-t border-zinc-200/80 px-1 pt-5">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Prep for tomorrow
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700">
                {prepItems.map((p) => (
                  <li key={p.id} className="flex gap-2">
                    <span className="text-zinc-400">·</span>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="h-6 shrink-0" aria-hidden />
        </div>
      </div>

      {mode === "edit" && inviteCode && dayId && roster ? (
        <ItemEditSheet
          open={Boolean(editingItem)}
          item={editingItem}
          inviteCode={inviteCode}
          dayId={dayId}
          roster={roster}
          onClose={() => setEditingItem(null)}
          onSaved={() => onReload?.()}
          onDelete={deleteItem}
          onError={(msg) => onError?.(msg)}
        />
      ) : null}
    </>
  );
}
