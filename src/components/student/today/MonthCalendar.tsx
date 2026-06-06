"use client";

import { useEffect, useMemo, useRef } from "react";
import { DateTime } from "luxon";

import { BUSY_DAY_THRESHOLD } from "@/lib/utils/day-density";
import { resolveCalendarLabel, isPreTripDay } from "@/lib/utils/calendar-label";

type ScheduleDay = {
  id: string;
  date: string;
  cityLabel: string;
  calendarLabel?: string | null;
};

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
  tripDates?: { startDate: string; endDate: string };
  itemCountByDayId?: Map<string, number>;
  firstItemTitleByDayId?: Map<string, string>;
  compact?: boolean;
}) {
  const {
    days,
    selectedDateISO,
    onSelectDate,
    tripDates,
    itemCountByDayId,
    firstItemTitleByDayId,
    compact = false,
  } = props;

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
    <div className={compact ? "flex flex-col gap-4" : "flex flex-col gap-6 pb-2"}>
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
                  : "mb-2 text-sm font-semibold text-zinc-900"
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

                if (!scheduled) {
                  return (
                    <div
                      key={iso}
                      className={
                        compact
                          ? "flex min-h-[2.5rem] flex-col items-center justify-center text-zinc-300"
                          : "flex min-h-[3rem] flex-col items-center justify-start rounded-md px-0.5 py-1 text-zinc-300"
                      }
                    >
                      <span
                        className={
                          compact
                            ? "text-[10px] tabular-nums"
                            : "text-sm tabular-nums"
                        }
                      >
                        {dayNum}
                      </span>
                    </div>
                  );
                }

                const label = tripDates
                  ? resolveCalendarLabel(
                      scheduled,
                      tripDates,
                      firstItemTitleByDayId?.get(scheduled.id),
                    )
                  : scheduled.cityLabel.slice(0, 9);
                const itemCount = itemCountByDayId?.get(scheduled.id) ?? 0;
                const isBusy = itemCount >= BUSY_DAY_THRESHOLD;
                const preTrip = tripDates ? isPreTripDay(scheduled, tripDates) : false;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelectDate(iso)}
                    className={[
                      "relative flex flex-col items-center justify-center text-center transition-colors",
                      compact
                        ? "min-h-[2.5rem] rounded-md"
                        : "min-h-[3rem] rounded-md px-0.5 py-0.5",
                      selected
                        ? "bg-zinc-900 text-white"
                        : preTrip
                          ? "bg-rose-50/60 text-zinc-900 hover:bg-rose-50"
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
                    {label ? (
                      <span
                        className={[
                          "max-w-full truncate text-[8px] leading-tight",
                          compact ? "px-0.5" : "mt-0.5 px-0.5",
                          selected ? "text-zinc-300" : "text-zinc-500",
                        ].join(" ")}
                      >
                        {label}
                      </span>
                    ) : null}
                    {isBusy ? (
                      <span
                        className={[
                          "absolute bottom-0.5 h-0.5 w-3 rounded-full",
                          selected ? "bg-zinc-400" : "bg-zinc-400/70",
                        ].join(" ")}
                        aria-hidden
                      />
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
