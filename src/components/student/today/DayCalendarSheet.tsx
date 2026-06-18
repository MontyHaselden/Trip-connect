"use client";

import { MonthCalendar } from "./MonthCalendar";
import { useStudentOverlay } from "@/components/student/StudentOverlayContext";
import { studentOverlayRootClass } from "@/lib/student/overlay-classes";

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
  const { contained } = useStudentOverlay();

  if (!open) return null;

  return (
    <div className={studentOverlayRootClass(contained, { zClass: "z-[60]" })}>
      <div role="presentation" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div
        className={`relative mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-[var(--student-surface)] shadow-xl ring-1 ring-[var(--student-line)] ${contained ? "max-h-[85%]" : "max-h-[min(68dvh,520px)] sm:rounded-2xl"}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--student-line)] px-4 py-2.5">
          <h2 className="text-sm font-semibold text-[var(--student-text)]">Calendar</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[var(--student-text-muted)]"
          >
            Done
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <MonthCalendar
            compact
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
