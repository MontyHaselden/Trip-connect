"use client";

import { MonthCalendar } from "./MonthCalendar";

export function CalendarSheet(props: {
  open: boolean;
  onClose: () => void;
  days: Array<{ id: string; date: string; cityLabel: string; sortOrder: number }>;
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
}) {
  const { open, onClose, days, selectedDateISO, onSelectDate } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative mx-auto flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-zinc-50 shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Calendar</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-zinc-600"
          >
            Done
          </button>
        </div>
        <div className="overflow-y-auto px-4 pt-4">
          <MonthCalendar
            days={days}
            selectedDateISO={selectedDateISO}
            onSelectDate={(d) => {
              onSelectDate(d);
              // Close after navigation is enqueued; avoids some mobile click quirks.
              requestAnimationFrame(() => onClose());
            }}
          />
        </div>
      </div>
    </div>
  );
}
