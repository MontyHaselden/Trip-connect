"use client";

import { useMemo } from "react";
import { DateTime } from "luxon";

import { shortDayLabel } from "@/lib/utils/time";

type ScheduleDay = { id: string; date: string; cityLabel: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
}) {
  const { days, selectedDateISO, onSelectDate } = props;

  const daysByDate = useMemo(() => {
    const m = new Map<string, ScheduleDay>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const months = useMemo(() => monthRangeForDays(days), [days]);

  return (
    <div className="flex flex-col gap-8 pb-4">
      {months.map((monthStart) => {
        const monthDays = monthStart.daysInMonth ?? 28;
        const gridStart = monthStart.startOf("month");
        const leading = (gridStart.weekday + 6) % 7;

        return (
          <section key={monthStart.toISODate()}>
            <h3 className="mb-3 text-sm font-semibold text-zinc-900">
              {monthStart.toFormat("LLLL yyyy")}
            </h3>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400"
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
                  ? shortDayLabel(scheduled.cityLabel, 9)
                  : "";

                if (!scheduled) {
                  return (
                    <div
                      key={iso}
                      className="flex min-h-[3.25rem] flex-col items-center justify-start rounded-md px-0.5 py-1 text-zinc-300"
                    >
                      <span className="text-sm tabular-nums">{dayNum}</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelectDate(iso)}
                    className={[
                      "flex min-h-[3.25rem] flex-col items-center justify-start rounded-md px-0.5 py-1 text-center transition-colors",
                      selected
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-900 hover:bg-zinc-100",
                    ].join(" ")}
                  >
                    <span className="text-sm font-medium tabular-nums">{dayNum}</span>
                    {label ? (
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
