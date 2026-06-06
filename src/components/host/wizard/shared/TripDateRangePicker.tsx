"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDisplay(iso: string): string {
  return DateTime.fromISO(iso).toFormat("d LLLL yyyy");
}

function isInRange(iso: string, start: string, end: string): boolean {
  if (!start || !end) return false;
  return iso >= start && iso <= end;
}

export function TripDateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
}) {
  const initialMonth = startDate
    ? DateTime.fromISO(startDate).startOf("month")
    : DateTime.now().startOf("month");
  const [viewMonth, setViewMonth] = useState(initialMonth);

  useEffect(() => {
    if (startDate) {
      setViewMonth(DateTime.fromISO(startDate).startOf("month"));
    }
  }, [startDate]);

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

  function onDayClick(iso: string) {
    if (!startDate || (startDate && endDate)) {
      onChange({ startDate: iso, endDate: "" });
      return;
    }
    if (iso < startDate) {
      onChange({ startDate: iso, endDate: startDate });
    } else {
      onChange({ startDate, endDate: iso });
    }
  }

  const rangeLabel =
    startDate && endDate
      ? `${formatDisplay(startDate)} → ${formatDisplay(endDate)}`
      : startDate
        ? `Leaving ${formatDisplay(startDate)} — choose your return-home day`
        : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <p className="font-medium">Which dates count as the trip?</p>
        <p className="mt-1 text-sky-900/90">
          Choose the day you <strong>leave home</strong> and the day you{" "}
          <strong>arrive back home</strong> — not when you land at the destination or
          leave the destination to fly home.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMonth((m) => m.minus({ months: 1 }))}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
            aria-label="Previous month"
          >
            ←
          </button>
          <p className="text-sm font-semibold text-zinc-900">
            {viewMonth.toFormat("LLLL yyyy")}
          </p>
          <button
            type="button"
            onClick={() => setViewMonth((m) => m.plus({ months: 1 }))}
            className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
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
            const { iso, day } = cell;
            const isStart = iso === startDate;
            const isEnd = iso === endDate;
            const inRange = isInRange(iso, startDate, endDate);
            const isEndpoint = isStart || isEnd;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onDayClick(iso)}
                className={[
                  "relative flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors",
                  isEndpoint
                    ? "bg-zinc-900 font-semibold text-white"
                    : inRange
                      ? "bg-zinc-200 text-zinc-900"
                      : "text-zinc-800 hover:bg-zinc-100",
                ].join(" ")}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
          <div className="flex gap-3">
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-zinc-900" />
              Leave / return home
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-zinc-200" />
              On trip
            </span>
          </div>
          {startDate && endDate ? (
            <button
              type="button"
              onClick={() => onChange({ startDate: "", endDate: "" })}
              className="text-zinc-500 underline hover:text-zinc-800"
            >
              Clear dates
            </button>
          ) : null}
        </div>
      </div>

      {rangeLabel ? (
        <p className="text-sm font-medium text-zinc-800">{rangeLabel}</p>
      ) : (
        <p className="text-sm text-zinc-500">Tap your leave-home day, then your return-home day.</p>
      )}
    </div>
  );
}
