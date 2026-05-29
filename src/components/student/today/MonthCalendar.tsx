"use client";

import { useEffect, useMemo, useRef } from "react";
import { DateTime } from "luxon";

import { shortDayLabel } from "@/lib/utils/time";

type ScheduleDay = { id: string; date: string; cityLabel: string };

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function monthRangeForDays(days: ScheduleDay[]) {
  if (!days.length) return [];
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const first = DateTime.fromISO(sorted[0]!.date).startOf("month");
  const last = DateTime.fromISO(sorted[sorted.length - 1]!.date).startOf("month");
  const months: DateTime[] = [];
  let cursor = first;
  while (cursor <= last) {
    months.push(cursor);
    cursor = cursor.plus({ months: 1 });
  }
  return months;
}

export function MonthCalendar(props: {
  days: ScheduleDay[];
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  compact?: boolean;
}) {
  const { days, selectedDateISO, onSelectDate, compact = false } = props;

  const daysByDate = useMemo(() => {
    const m = new Map<string, ScheduleDay>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const months = useMemo(() => monthRangeForDays(days), [days]);
  const selectedMonthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedMonthRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedDateISO]);

  if (!months.length) {
    return <p className="py-4 text-center text-xs text-zinc-500">No dates yet</p>;
  }

  return (
    <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-8 pb-4"}>
      {months.map((monthStart) => {
        const monthDays = monthStart.daysInMonth ?? 28;
        const gridStart = monthStart.startOf("month");
        const leading = (gridStart.weekday + 6) % 7;
        const containsSelected = selectedDateISO.startsWith(
          monthStart.toFormat("yyyy-MM"),
        );

        return (
          <section
            key={monthStart.toISODate()}
            ref={containsSelected ? selectedMonthRef : undefined}
          >
            <h3
              className={
                compact
                  ? "mb-1.5 text-[10px] font-semibold text-zinc-700"
                  : "mb-3 text-sm font-semibold text-zinc-900"
              }
            >
              {monthStart.toFormat(compact ? "LLL yyyy" : "LLLL yyyy")}
            </h3>
            <div className="grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((wd, i) => (
                <div
                  key={`${wd}-${i}`}
                  className={
                    compact
                      ? "pb-0.5 text-center text-[8px] font-medium text-zinc-400"
                      : "pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400"
                  }
                >
                  {wd}
                </div>
              ))}
              {Array.from({ length: leading }).map((_, i) => (
                <div key={`pad-${i}`} aria-hidden />
              ))}
              {Array.from({ length: monthDays }, (_, i) => i + 1).map((dayNum) => {
                const dt = monthStart.set({ day: dayNum });
                const iso = dt.toISODate();
                if (!iso) return null;
                const scheduled = daysByDate.get(iso);
                const selected = iso === selectedDateISO;
                const label = scheduled
                  ? shortDayLabel(scheduled.cityLabel, compact ? 5 : 9)
                  : "";

                if (!scheduled) {
                  return (
                    <div
                      key={iso}
                      className={
                        compact
                          ? "flex min-h-[2rem] flex-col items-center justify-center text-zinc-300"
                          : "flex min-h-[3.25rem] flex-col items-center justify-start rounded-md px-0.5 py-1 text-zinc-300"
                      }
                    >
                      <span className={compact ? "text-[10px] tabular-nums" : "text-sm tabular-nums"}>
                        {dayNum}
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelectDate(iso)}
                    className={[
                      "flex flex-col items-center justify-center text-center transition-colors",
                      compact ? "min-h-[2rem] rounded-md" : "min-h-[3.25rem] rounded-md px-0.5 py-1",
                      selected
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-900 hover:bg-zinc-100",
                    ].join(" ")}
                  >
                    <span
                      className={
                        compact
                          ? "text-[10px] font-semibold tabular-nums"
                          : "text-sm font-medium tabular-nums"
                      }
                    >
                      {dayNum}
                    </span>
                    {label && !compact ? (
                      <span
                        className={[
                          "mt-0.5 max-w-full truncate text-[9px] leading-tight",
                          selected ? "text-zinc-300" : "text-zinc-500",
                        ].join(" ")}
                      >
                        {label}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
