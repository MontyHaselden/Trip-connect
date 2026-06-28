"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DayWeatherSnapshot } from "@/types/activity-category";
import { computeDayWindowBlockLayouts } from "@/lib/timeline/day-window-layout";
import { computeCompactBlockLayouts } from "@/lib/timeline/compact-day-layout";
import {
  getNowMinutes,
  isActiveAtNow,
  computeLayoutSpanMinutesById,
  timeToMinutes,
} from "@/lib/timeline/time-math";
import type { ItineraryRowItem } from "@/lib/utils/itinerary-item-style";

import { ActivityDetailSheet } from "./ActivityDetailSheet";
import { CompactItineraryRow } from "./CompactItineraryRow";
import { RunSheetTimeline } from "./RunSheetTimeline";

function DayRemindersFooter(props: {
  reminders: Array<{
    id: string;
    title: string;
    reminderTime: string | null;
    note: string | null;
  }>;
}) {
  if (!props.reminders.length) return null;

  return (
    <div className="shrink-0 border-t border-[var(--student-line)] px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--student-text-muted)]">
        Reminders
      </p>
      <ul className="mt-1.5 space-y-2">
        {props.reminders.map((r) => (
          <li key={r.id} className="text-xs leading-snug text-[var(--student-text)]">
            {r.reminderTime ? (
              <span className="mr-1.5 font-semibold tabular-nums text-[var(--student-text-muted)]">
                {r.reminderTime.slice(0, 5)}
              </span>
            ) : null}
            <span className="font-medium">{r.title}</span>
            {r.note ? (
              <span className="mt-0.5 block text-[var(--student-text-muted)]">{r.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompactDaySheet(props: {
  items: ItineraryRowItem[];
  prepItems: Array<{ id: string; text: string }>;
  dayReminders?: Array<{
    id: string;
    title: string;
    reminderTime: string | null;
    note: string | null;
  }>;
  tripTimezone: string;
  dateISO: string;
  cityLabel: string;
  weather?: DayWeatherSnapshot | null;
  tripStartDate: string;
  isViewingToday: boolean;
  mapsOnline: boolean;
  animateItemIds?: Set<string>;
  typewriterItemId?: string | null;
  buildingEmptyLabel?: string | null;
  listFooter?: ReactNode;
  nightStay?: { name: string | null; color: string } | null;
  hostEditing?: {
    onEditItem: (item: ItineraryRowItem) => void;
  };
  layout?: "run-sheet" | "legacy-blocks";
}) {
  const {
    items,
    prepItems,
    dayReminders = [],
    tripTimezone,
    isViewingToday,
    mapsOnline,
    animateItemIds,
    typewriterItemId,
    buildingEmptyLabel,
    listFooter,
    nightStay,
    cityLabel,
    hostEditing,
    layout = "run-sheet",
  } = props;

  const [selectedItem, setSelectedItem] = useState<ItineraryRowItem | null>(null);

  const nowMinutes = isViewingToday ? getNowMinutes(tripTimezone, props.dateISO) : null;

  const { activeId, nextId } = useMemo(() => {
    if (nowMinutes === null) return { activeId: null as string | null, nextId: null as string | null };

    let active: string | null = null;
    let next: string | null = null;

    for (const item of items) {
      const start = timeToMinutes(item.startTime);
      const end = item.endTime ? timeToMinutes(item.endTime) : start + 60;
      if (isActiveAtNow(nowMinutes, start, end)) {
        active = item.id;
        break;
      }
      if (start > nowMinutes && !next) {
        next = item.id;
      }
    }

    return { activeId: active, nextId: next };
  }, [items, nowMinutes]);

  const listRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    if (layout !== "run-sheet") return;
    const el = listRef.current;
    if (!el) return;

    const measure = () => setContainerHeight(el.clientHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items.length, layout, prepItems.length, dayReminders.length, listFooter]);

  const dayWindowLayout = useMemo(
    () =>
      layout === "run-sheet"
        ? computeDayWindowBlockLayouts(items, containerHeight)
        : null,
    [items, containerHeight, layout],
  );

  const layoutSpans = useMemo(() => computeLayoutSpanMinutesById(items), [items]);
  const legacyListRef = useRef<HTMLDivElement>(null);
  const [legacyContainerHeight, setLegacyContainerHeight] = useState(0);

  useEffect(() => {
    if (layout !== "legacy-blocks") return;
    const el = legacyListRef.current;
    if (!el) return;

    const measure = () => setLegacyContainerHeight(el.clientHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length, layout]);

  const blockLayout = useMemo(
    () =>
      layout === "legacy-blocks"
        ? computeCompactBlockLayouts(items, layoutSpans, legacyContainerHeight)
        : null,
    [items, layoutSpans, legacyContainerHeight, layout],
  );

  const hasContent =
    items.length > 0 || prepItems.length > 0 || dayReminders.length > 0 || listFooter;

  if (!hasContent) {
    const locationLine = (() => {
      const city = cityLabel.trim();
      if (!city) return null;
      if (city.includes("→")) return city;
      return `In ${city}`;
    })();

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          {buildingEmptyLabel ? (
            <p className="text-sm font-medium text-[var(--student-text-muted)]">
              {buildingEmptyLabel}
            </p>
          ) : (
            <>
              {locationLine ? (
                <p className="text-lg font-semibold text-[var(--student-text)]">{locationLine}</p>
              ) : null}
              {nightStay?.name ? (
                <div className="flex items-center justify-center gap-2 text-sm text-[var(--student-text-muted)]">
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-[var(--student-line)]"
                    style={{ backgroundColor: nightStay.color }}
                    aria-hidden
                  />
                  <span>Staying at {nightStay.name}</span>
                </div>
              ) : null}
              <p className="text-sm text-[var(--student-text-muted)]">No scheduled activities</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const prepFooter =
    prepItems.length > 0 ? (
      <div className="shrink-0 border-t border-[var(--student-line)] px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--student-text-muted)]">
          Tomorrow prep
        </p>
        <ul className="mt-1 space-y-0.5">
          {prepItems.map((p) => (
            <li key={p.id} className="text-xs leading-snug text-[var(--student-text-muted)]">
              · {p.text}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const remindersFooter = <DayRemindersFooter reminders={dayReminders} />;

  const combinedFooter = (
    <>
      {remindersFooter}
      {prepFooter}
      {listFooter}
    </>
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {nightStay ? (
          <div className="mb-2 flex shrink-0 items-center gap-2 text-xs text-[var(--student-text-muted)]">
            <span
              className="h-2.5 w-2.5 rounded-full ring-1 ring-[var(--student-line)]"
              style={{ backgroundColor: nightStay.color }}
              aria-hidden
            />
            <span>Staying at {nightStay.name ?? "accommodation"}</span>
          </div>
        ) : null}

        {layout === "run-sheet" ? (
          <RunSheetTimeline
            listRef={listRef}
            items={items}
            tripTimezone={tripTimezone}
            activeId={activeId}
            nextId={nextId}
            heightsById={dayWindowLayout?.heightsById ?? new Map()}
            needsScroll={dayWindowLayout?.needsScroll ?? false}
            onTapItem={(item) =>
              hostEditing ? hostEditing.onEditItem(item) : setSelectedItem(item)
            }
            animateItemIds={animateItemIds}
            typewriterItemId={typewriterItemId}
            listFooter={combinedFooter}
          />
        ) : (
          <div
            ref={legacyListRef}
            className={[
              "relative flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white shadow-sm",
              blockLayout?.needsScroll
                ? "no-scrollbar overflow-y-auto overscroll-y-contain"
                : "overflow-hidden",
            ].join(" ")}
          >
            {items.map((item) => (
              <CompactItineraryRow
                key={item.id}
                item={item}
                tripTimezone={tripTimezone}
                isActive={item.id === activeId}
                isNext={item.id === nextId && item.id !== activeId}
                onTap={() =>
                  hostEditing
                    ? hostEditing.onEditItem(item)
                    : setSelectedItem(item)
                }
                spanMinutes={layoutSpans.spanById.get(item.id) ?? 60}
                heightPx={blockLayout?.heightsById.get(item.id) ?? 48}
                minBlockHeightPx={blockLayout?.minBlockHeightPx ?? 48}
                animateIn={animateItemIds?.has(item.id)}
                typewriterTitle={typewriterItemId === item.id}
              />
            ))}
            {combinedFooter}
          </div>
        )}
      </div>

      <ActivityDetailSheet
        item={hostEditing ? null : selectedItem}
        tripTimezone={tripTimezone}
        mapsEnabled={mapsOnline}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}
