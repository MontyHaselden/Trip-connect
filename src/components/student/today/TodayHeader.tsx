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
  } = props;

  const dateLine = formatTripDateHeader({ dateISO, tripTimezone });
  const beforeTrip =
    tripStartDate &&
    dateISO < tripStartDate &&
    daysUntilTrip({ startDate: tripStartDate, dateISO, tripTimezone });

  return (
    <header className="border-b border-zinc-200/80 pb-5 pt-1">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label="Previous day"
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-zinc-800 disabled:pointer-events-none disabled:opacity-25"
        >
          ‹
        </button>

        <div className="min-w-0 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
            {dateLine}
          </h1>
          {cityLabel ? (
            <p className="mt-1 truncate text-sm text-zinc-600">{cityLabel}</p>
          ) : null}
          {typeof beforeTrip === "number" && beforeTrip > 0 ? (
            <p className="mt-1 text-xs text-zinc-500">
              {beforeTrip} day{beforeTrip === 1 ? "" : "s"} until trip
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Next day"
          className="flex h-10 w-10 items-center justify-center text-xl font-light text-zinc-800 disabled:pointer-events-none disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={onOpenCalendar}
          className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2"
        >
          Calendar
        </button>
      </div>
    </header>
  );
}
