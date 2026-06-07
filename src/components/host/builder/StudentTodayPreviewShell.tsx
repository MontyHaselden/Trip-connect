"use client";

import type { ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import { DayCalendarSheet } from "@/components/student/today/DayCalendarSheet";

type PreviewDay = {
  id: string;
  date: string;
  cityLabel: string;
  calendarLabel?: string | null;
  sortOrder?: number;
};

function PinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function DayLocationPreview(props: {
  open: boolean;
  onToggle: () => void;
  anchorRef: RefObject<HTMLDivElement | null>;
  date: string;
  cityLabel: string;
  nightStay?: { name: string | null; color: string } | null;
}) {
  const { open, onToggle, anchorRef, date, cityLabel, nightStay } = props;

  return (
    <div ref={anchorRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex items-center justify-center rounded-lg p-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      >
        <PinIcon />
        <span className="sr-only">Location and accommodation for this day</span>
      </button>
      {open ? (
        <div className="absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-lg">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {date}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">{cityLabel}</p>
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <p className="text-xs font-medium text-zinc-500">Accommodation</p>
            {nightStay?.name ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-zinc-800">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: nightStay.color }}
                  aria-hidden
                />
                {nightStay.name}
              </p>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Not set yet</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BottomNavPreview() {
  return (
    <nav className="relative z-20 mt-auto shrink-0 bg-zinc-50 pb-[max(env(safe-area-inset-bottom),0px)]">
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-1 p-1.5">
          <span className="flex flex-1 items-center justify-center rounded-lg bg-zinc-900 px-2 py-2 text-sm font-medium text-white">
            Today
          </span>
          <span className="flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-sm font-medium text-zinc-700">
            My Trip
          </span>
        </div>
      </div>
    </nav>
  );
}

export function StudentTodayPreviewShell(props: {
  timezone: string;
  startDate: string;
  endDate?: string;
  days: PreviewDay[];
  selectedDayId: string | null;
  onSelectDayId: (dayId: string) => void;
  itemCountByDayId: Map<string, number>;
  firstItemTitleByDayId: Map<string, string>;
  nightStay?: { name: string | null; color: string } | null;
  children: ReactNode;
}) {
  const {
    timezone,
    startDate,
    endDate,
    days,
    selectedDayId,
    onSelectDayId,
    itemCountByDayId,
    firstItemTitleByDayId,
    nightStay,
    children,
  } = props;

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const locationAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!locationOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (locationAnchorRef.current?.contains(e.target as Node)) return;
      setLocationOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [locationOpen]);

  const scheduledDays = useMemo(
    () => [...days].sort((a, b) => a.date.localeCompare(b.date)),
    [days],
  );

  const selectedDay = useMemo(() => {
    if (!scheduledDays.length) return null;
    return scheduledDays.find((d) => d.id === selectedDayId) ?? scheduledDays[0];
  }, [scheduledDays, selectedDayId]);

  const selectedIndex = selectedDay
    ? scheduledDays.findIndex((d) => d.id === selectedDay.id)
    : -1;

  const centredHeader = useMemo(() => {
    if (!selectedDay) return null;
    const dt = DateTime.fromISO(selectedDay.date, { zone: timezone });
    return {
      dateLine: dt.toFormat("cccc d LLLL"),
      cityLabel: selectedDay.cityLabel,
    };
  }, [selectedDay, timezone]);

  function goPrev() {
    if (selectedIndex <= 0) return;
    const prev = scheduledDays[selectedIndex - 1];
    if (prev) onSelectDayId(prev.id);
  }

  function goNext() {
    if (selectedIndex < 0 || selectedIndex >= scheduledDays.length - 1) return;
    const next = scheduledDays[selectedIndex + 1];
    if (next) onSelectDayId(next.id);
  }

  const canGoPrev = selectedIndex > 0;
  const canGoNext =
    selectedIndex >= 0 && selectedIndex < scheduledDays.length - 1;

  return (
    <div className="flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-2 overflow-hidden px-4 py-3">
        <header className="shrink-0 border-b border-zinc-200/80 pb-2 pt-0.5">
          {centredHeader ? (
            <div className="text-center">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canGoPrev}
                  className="h-8 w-8 text-lg text-zinc-700 disabled:opacity-30"
                  aria-label="Previous day"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocationOpen(false);
                    setCalendarOpen(true);
                  }}
                  className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700"
                >
                  Calendar
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="h-8 w-8 text-lg text-zinc-700 disabled:opacity-30"
                  aria-label="Next day"
                >
                  ›
                </button>
              </div>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <h1 className="text-lg font-semibold tracking-tight">
                  {centredHeader.dateLine}
                </h1>
                <DayLocationPreview
                  open={locationOpen}
                  onToggle={() => setLocationOpen((open) => !open)}
                  anchorRef={locationAnchorRef}
                  date={selectedDay!.date}
                  cityLabel={centredHeader.cityLabel}
                  nightStay={nightStay}
                />
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-zinc-500">No days yet</p>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>

        <BottomNavPreview />
      </div>

      {selectedDay ? (
        <DayCalendarSheet
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          days={scheduledDays.map((d, i) => ({
            ...d,
            sortOrder: d.sortOrder ?? i,
          }))}
          selectedDateISO={selectedDay.date}
          tripDates={
            endDate ? { startDate, endDate } : undefined
          }
          itemCountByDayId={itemCountByDayId}
          firstItemTitleByDayId={firstItemTitleByDayId}
          onSelectDate={(dateISO) => {
            const match = scheduledDays.find((d) => d.date === dateISO);
            if (match) onSelectDayId(match.id);
          }}
        />
      ) : null}
    </div>
  );
}
