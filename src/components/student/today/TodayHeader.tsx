"use client";

import { formatTripDateHeader, daysUntilTrip } from "@/lib/utils/time";

export function TodayHeader(props: {
  dateISO: string;
  cityLabel: string;
  tripTimezone: string;
  tripStartDate?: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenCalendar: () => void;
  variant?: "top" | "dock";
}) {
  const {
    dateISO,
    cityLabel,
    tripTimezone,
    tripStartDate,
    canGoPrev,
    canGoNext,
    onPrev,
    onNext,
    onOpenCalendar,
    variant = "top",
  } = props;

  const dateLine = formatTripDateHeader({ dateISO, tripTimezone });
  const beforeTrip =
    tripStartDate &&
    dateISO < tripStartDate &&
    daysUntilTrip({ startDate: tripStartDate, dateISO, tripTimezone });

  const chrome =
    variant === "dock"
      ? "sticky bottom-0 border-t border-zinc-200/80 bg-zinc-50/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80"
      : "border-b border-zinc-200/80 pt-1";

  return (
    <header className={[chrome, "pb-4"].join(" ")}>
      <div className="px-0 pt-3">
        <div className="min-w-0 text-center">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            {dateLine}
          </h1>
          {cityLabel ? (
            <p className="mt-0.5 truncate text-sm text-zinc-600">{cityLabel}</p>
          ) : null}
          {typeof beforeTrip === "number" && beforeTrip > 0 ? (
            <p className="mt-0.5 text-xs text-zinc-500">
              {beforeTrip} day{beforeTrip === 1 ? "" : "s"} until trip
            </p>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canGoPrev}
            aria-label="Previous day"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl font-light text-zinc-800 disabled:pointer-events-none disabled:opacity-25"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={onOpenCalendar}
            className="h-10 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700"
          >
            Calendar
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            aria-label="Next day"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl font-light text-zinc-800 disabled:pointer-events-none disabled:opacity-25"
          >
            ›
          </button>
        </div>
      </div>
    </header>
  );
}
