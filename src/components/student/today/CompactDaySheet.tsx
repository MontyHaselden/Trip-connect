"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { DayWeatherSnapshot } from "@/types/activity-category";
import { computeCompactBlockLayouts } from "@/lib/timeline/compact-day-layout";
import { daysUntilTrip } from "@/lib/utils/time";
import {
  computeDisplayDurationsById,
  getNowMinutes,
  isActiveAtNow,
  timeToMinutes,
} from "@/lib/timeline/time-math";
import type { ItineraryRowItem } from "@/lib/utils/itinerary-item-style";

import { ActivityDetailSheet } from "./ActivityDetailSheet";
import { CompactItineraryRow } from "./CompactItineraryRow";
import { DayDensityBadge } from "./DayDensityBadge";
import { DayWeatherStrip } from "./DayWeatherStrip";

export function CompactDaySheet(props: {
  items: ItineraryRowItem[];
  prepItems: Array<{ id: string; text: string }>;
  tripTimezone: string;
  dateISO: string;
  cityLabel: string;
  weather?: DayWeatherSnapshot | null;
  tripStartDate: string;
  isViewingToday: boolean;
  mapsOnline: boolean;
}) {
  const {
    items,
    prepItems,
    tripTimezone,
    dateISO,
    cityLabel,
    weather,
    tripStartDate,
    isViewingToday,
    mapsOnline,
  } = props;

  const [selectedItem, setSelectedItem] = useState<ItineraryRowItem | null>(null);

  const daysUntil =
    dateISO < tripStartDate
      ? daysUntilTrip({
          startDate: tripStartDate,
          dateISO,
          tripTimezone,
        })
      : null;

  const nowMinutes = isViewingToday ? getNowMinutes(tripTimezone, dateISO) : null;

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

  const isPreTrip = dateISO < tripStartDate;

  const nextMeetingLine = useMemo(() => {
    if (!isPreTrip) return null;
    const meetings = items
      .filter((i) => i.category === "meeting")
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    if (!meetings.length) return null;
    const next =
      nowMinutes !== null
        ? meetings.find((m) => timeToMinutes(m.startTime) >= nowMinutes) ?? meetings[0]
        : meetings[0];
    const time = next.startTime.slice(0, 5);
    return `Next meeting: ${next.title} at ${time}`;
  }, [isPreTrip, items, nowMinutes]);

  const durationById = useMemo(() => computeDisplayDurationsById(items), [items]);
  const listRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const measure = () => setContainerHeight(el.clientHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length]);

  const blockLayout = useMemo(
    () => computeCompactBlockLayouts(items, durationById, containerHeight),
    [items, durationById, containerHeight],
  );

  const hasContent = items.length > 0 || prepItems.length > 0;

  if (!hasContent) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <DayWeatherStrip cityLabel={cityLabel} weather={weather} />
        {typeof daysUntil === "number" && daysUntil > 0 ? (
          <p className="text-xs text-zinc-500">
            {daysUntil} day{daysUntil === 1 ? "" : "s"} until trip
          </p>
        ) : null}
        {nextMeetingLine ? (
          <p className="text-xs font-medium text-sky-800">{nextMeetingLine}</p>
        ) : null}
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="text-sm font-medium text-zinc-800">No event today</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 space-y-0.5 pb-1">
          <DayWeatherStrip cityLabel={cityLabel} weather={weather} />
          {typeof daysUntil === "number" && daysUntil > 0 ? (
            <p className="text-xs text-zinc-500">
              {daysUntil} day{daysUntil === 1 ? "" : "s"} until trip
            </p>
          ) : null}
          {nextMeetingLine ? (
            <p className="text-xs font-medium text-sky-800">{nextMeetingLine}</p>
          ) : null}
          <DayDensityBadge itemCount={items.length} />
        </div>

        {items.length > 0 ? (
          <div
            ref={listRef}
            className={[
              "flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-200 bg-white shadow-sm",
              blockLayout.needsScroll
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
                onTap={() => setSelectedItem(item)}
                durationMinutes={durationById.get(item.id) ?? 60}
                heightPx={blockLayout.heightsById.get(item.id) ?? 48}
              />
            ))}
          </div>
        ) : null}

        {prepItems.length > 0 ? (
          <div className="mt-2 shrink-0 border-t border-zinc-100 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Tomorrow prep
            </p>
            <ul className="mt-1 space-y-0.5">
              {prepItems.map((p) => (
                <li key={p.id} className="text-xs leading-snug text-zinc-600">
                  · {p.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <ActivityDetailSheet
        item={selectedItem}
        tripTimezone={tripTimezone}
        mapsEnabled={mapsOnline}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
}
