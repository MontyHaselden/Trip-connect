"use client";

import { MonthCalendar } from "./MonthCalendar";

export function DayCalendarSheet(props: {
  open: boolean;
  onClose: () => void;
  days: Array<{
    id: string;
    date: string;
    cityLabel: string;
    calendarLabel?: string | null;
    sortOrder: number;
  }>;
  selectedDateISO: string;
  tripDates?: { startDate: string; endDate: string };
  itemCountByDayId?: Map<string, number>;
  firstItemTitleByDayId?: Map<string, string>;
  onSelectDate: (dateISO: string) => void;
}) {
  const { open, onClose, days, selectedDateISO, tripDates, itemCountByDayId, firstItemTitleByDayId, onSelectDate } =
    props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div role="presentation" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="relative mx-auto max-h-[85dvh] w-full max-w-md overflow-hidden rounded-t-2xl bg-zinc-50 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Calendar</h2>
          <button type="button" onClick={onClose} className="text-sm font-medium text-zinc-600">
            Done
          </button>
        </div>
        <div className="overflow-y-auto px-3 py-3">
          <MonthCalendar
            days={days}
            selectedDateISO={selectedDateISO}
            tripDates={tripDates}
            itemCountByDayId={itemCountByDayId}
            firstItemTitleByDayId={firstItemTitleByDayId}
            onSelectDate={(d) => {
              onSelectDate(d);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
