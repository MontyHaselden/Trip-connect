"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import {
  locationBorderColor,
  locationColor,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shortCity(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 9)}…`;
}

function DayCell({
  day,
  isSelectable,
  isInPendingRange,
  isRangeStart,
  isRangeEnd,
  onSelect,
  onShareChange,
}: {
  day: DayPlaceDraft | null;
  isSelectable: boolean;
  isInPendingRange: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  onSelect?: () => void;
  onShareChange?: (share: number) => void;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const primary = day?.primaryCity.trim() ?? "";
  const secondary = day?.secondaryCity?.trim() ?? "";
  const share = day?.primaryShare ?? 1;
  const isSplit = Boolean(primary && (secondary || share < 1));
  const isBuffer = day?.dayType === "buffer";

  useEffect(() => {
    const onShare = onShareChange;
    if (!isSplit || !onShare) return;

    function onMove(clientX: number) {
      const el = cellRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const clamped = Math.min(0.85, Math.max(0.15, ratio));
      if (onShare) onShare(clamped);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging.current) return;
      onMove(e.clientX);
    }

    function onPointerUp() {
      dragging.current = false;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isSplit, onShareChange]);

  const content = (
    <div
      ref={cellRef}
      className={[
        "relative h-[4.5rem] w-full overflow-hidden rounded-lg border text-[10px] leading-tight",
        isBuffer ? "border-dashed border-zinc-300" : "border-zinc-200",
        isInPendingRange ? "ring-2 ring-sky-400 ring-offset-1" : "",
        isRangeStart || isRangeEnd ? "ring-2 ring-zinc-900 ring-offset-1" : "",
        isSelectable ? "cursor-pointer hover:border-zinc-400" : "",
      ].join(" ")}
      onClick={isSelectable ? onSelect : undefined}
      onKeyDown={
        isSelectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onSelect?.();
            }
          : undefined
      }
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
    >
      {primary ? (
        <div
          className="absolute inset-y-0 left-0 flex items-end justify-start overflow-hidden p-1"
          style={{
            width: `${share * 100}%`,
            backgroundColor: locationColor(primary),
            borderRight: isSplit ? `2px solid ${locationBorderColor(primary)}` : undefined,
          }}
        >
          <span className="font-medium text-zinc-800">{shortCity(primary)}</span>
        </div>
      ) : null}
      {secondary ? (
        <div
          className="absolute inset-y-0 right-0 flex items-end justify-end overflow-hidden p-1"
          style={{
            width: `${(1 - share) * 100}%`,
            backgroundColor: locationColor(secondary),
          }}
        >
          <span className="font-medium text-zinc-800">{shortCity(secondary)}</span>
        </div>
      ) : primary && share < 1 ? (
        <div
          className="absolute inset-y-0 right-0 bg-zinc-100/80"
          style={{ width: `${(1 - share) * 100}%` }}
        />
      ) : null}
      {isSplit && onShareChange ? (
        <div
          className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-col-resize"
          style={{ left: `${share * 100}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          aria-label="Drag to adjust time in each location"
        >
          <div className="mx-auto h-full w-0.5 bg-zinc-700/70" />
        </div>
      ) : null}
      {!primary && !secondary ? (
        <div className="flex h-full items-center justify-center text-zinc-400">—</div>
      ) : null}
    </div>
  );

  return content;
}

export function LocationStayCalendar({
  days,
  tripStart,
  tripEnd,
  selectable = false,
  pendingRangeStart,
  pendingRangeEnd,
  onDayClick,
  onShareChange,
}: {
  days: DayPlaceDraft[];
  tripStart: string;
  tripEnd: string;
  selectable?: boolean;
  pendingRangeStart?: string;
  pendingRangeEnd?: string;
  onDayClick?: (iso: string) => void;
  onShareChange?: (date: string, share: number) => void;
}) {
  const dayByDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const calendarStart = useMemo(() => {
    const first = days[0]?.date ?? tripStart;
    return DateTime.fromISO(first).startOf("month");
  }, [days, tripStart]);

  const calendarEnd = useMemo(() => {
    const last = days[days.length - 1]?.date ?? tripEnd;
    return DateTime.fromISO(last).startOf("month");
  }, [days, tripEnd]);

  const months = useMemo(() => {
    const out: DateTime[] = [];
    let cur = calendarStart;
    while (cur <= calendarEnd) {
      out.push(cur);
      cur = cur.plus({ months: 1 });
    }
    return out;
  }, [calendarStart, calendarEnd]);

  const [viewMonth, setViewMonth] = useState(calendarStart);

  useEffect(() => {
    setViewMonth(calendarStart);
  }, [calendarStart.toISO()]);

  const monthDays = useMemo(() => {
    const daysInMonth = viewMonth.daysInMonth ?? 28;
    const leading = (viewMonth.startOf("month").weekday + 6) % 7;
    const cells: Array<{ iso: string; day: number } | null> = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = viewMonth.set({ day: d }).toISODate();
      if (iso) cells.push({ iso, day: d });
    }
    return cells;
  }, [viewMonth]);

  function inPendingRange(iso: string): boolean {
    if (!pendingRangeStart) return false;
    if (!pendingRangeEnd) return iso === pendingRangeStart;
    return iso >= pendingRangeStart && iso <= pendingRangeEnd;
  }

  function isTripDay(iso: string): boolean {
    return iso >= tripStart && iso <= tripEnd;
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth((m) => m.minus({ months: 1 }))}
          disabled={viewMonth <= calendarStart}
          className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-zinc-900">{viewMonth.toFormat("LLLL yyyy")}</p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => m.plus({ months: 1 }))}
          disabled={viewMonth >= calendarEnd}
          className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400"
          >
            {wd.slice(0, 1)}
          </div>
        ))}
        {monthDays.map((cell, i) => {
          if (!cell) return <div key={`pad-${i}`} aria-hidden />;
          const { iso, day: dayNum } = cell;
          const day = dayByDate.get(iso) ?? null;
          const inTrip = isTripDay(iso);
          const onCalendar = day !== null;

          return (
            <div key={iso} className="space-y-0.5">
              <p
                className={[
                  "text-center text-[10px] font-medium",
                  inTrip ? "text-zinc-800" : "text-zinc-400",
                ].join(" ")}
              >
                {dayNum}
              </p>
              {onCalendar ? (
                <DayCell
                  day={day}
                  isSelectable={selectable && inTrip}
                  isInPendingRange={inPendingRange(iso)}
                  isRangeStart={iso === pendingRangeStart}
                  isRangeEnd={iso === pendingRangeEnd}
                  onSelect={() => onDayClick?.(iso)}
                  onShareChange={
                    onShareChange && day?.secondaryCity
                      ? (share) => onShareChange(iso, share)
                      : onShareChange && day && day.primaryShare < 1 && day.primaryCity
                        ? (share) => onShareChange(iso, share)
                        : undefined
                  }
                />
              ) : (
                <div className="h-[4.5rem]" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <span>Half-filled edge days = travel in/out of a location</span>
        <span>Drag the line on split days to adjust time in each place</span>
      </div>
    </div>
  );
}
