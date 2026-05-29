"use client";

import { MonthCalendar } from "./MonthCalendar";

export function TodayCalendarDock(props: {
  days: Array<{ id: string; date: string; cityLabel: string; sortOrder: number }>;
  selectedDateISO: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectDate: (dateISO: string) => void;
}) {
  const {
    days,
    selectedDateISO,
    canGoPrev,
    canGoNext,
    onPrev,
    onNext,
    onSelectDate,
  } = props;

  return (
    <footer className="shrink-0 border-t border-zinc-200/80 bg-zinc-50/95 pt-3 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/85">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-stretch gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          aria-label="Previous day"
          className="flex min-h-[7.5rem] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-3xl font-light text-zinc-800 shadow-sm disabled:pointer-events-none disabled:opacity-25"
        >
          ‹
        </button>

        <div className="min-h-[7.5rem] max-h-[9.5rem] overflow-y-auto rounded-2xl border border-zinc-200 bg-white px-2 py-2 shadow-sm">
          <MonthCalendar
            compact
            days={days}
            selectedDateISO={selectedDateISO}
            onSelectDate={onSelectDate}
          />
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Next day"
          className="flex min-h-[7.5rem] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-3xl font-light text-zinc-800 shadow-sm disabled:pointer-events-none disabled:opacity-25"
        >
          ›
        </button>
      </div>
    </footer>
  );
}
