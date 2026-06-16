"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { TripAppContext, type TodayDayMeta, type TodayDayNav } from "@/components/layout/TripAppContext";
import { StudentBottomNav } from "@/components/layout/StudentBottomNav";
import { TravelPassHeader } from "@/components/student/TravelPassHeader";
import { DayCalendarSheet } from "@/components/student/today/DayCalendarSheet";
import type { TripCacheState } from "@/hooks/useTripCache";
import { plusJakartaSans } from "@/lib/fonts/student-font";
import type { DayWeatherSnapshot } from "@/types/activity-category";

type PreviewDay = {
  id: string;
  date: string;
  cityLabel: string;
  calendarLabel?: string | null;
  sortOrder?: number;
  weather?: DayWeatherSnapshot | null;
};

export function StudentTodayPreviewShell(props: {
  tripId: string;
  tripName: string;
  inviteCode: string;
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
    tripId,
    tripName,
    inviteCode,
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

  const scheduledDays = useMemo(
    () =>
      [...days]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d, i) => ({
          ...d,
          sortOrder: d.sortOrder ?? i,
        })),
    [days],
  );

  const selectedDay = useMemo(() => {
    if (!scheduledDays.length) return null;
    return scheduledDays.find((d) => d.id === selectedDayId) ?? scheduledDays[0];
  }, [scheduledDays, selectedDayId]);

  const selectedIndex = selectedDay
    ? scheduledDays.findIndex((d) => d.id === selectedDay.id)
    : -1;

  const todayISO = useMemo(
    () => DateTime.now().setZone(timezone).toISODate(),
    [timezone],
  );

  const isViewingToday = Boolean(
    selectedDay && todayISO && selectedDay.date === todayISO,
  );

  const setDate = useCallback(
    (dateISO: string) => {
      const match = scheduledDays.find((d) => d.date === dateISO);
      if (match) onSelectDayId(match.id);
    },
    [scheduledDays, onSelectDayId],
  );

  const goPrev = useCallback(() => {
    if (selectedIndex <= 0) return;
    const prev = scheduledDays[selectedIndex - 1];
    if (prev) onSelectDayId(prev.id);
  }, [selectedIndex, scheduledDays, onSelectDayId]);

  const goNext = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= scheduledDays.length - 1) return;
    const next = scheduledDays[selectedIndex + 1];
    if (next) onSelectDayId(next.id);
  }, [selectedIndex, scheduledDays, onSelectDayId]);

  const canGoPrev = selectedIndex > 0;
  const canGoNext =
    selectedIndex >= 0 && selectedIndex < scheduledDays.length - 1;

  const todayNav: TodayDayNav | null = selectedDay
    ? {
        scheduledDays,
        selectedDateISO: selectedDay.date,
        canGoPrev,
        canGoNext,
        goPrev,
        goNext,
        setDate,
        tripStartDate: startDate,
        tripEndDate: endDate ?? startDate,
      }
    : null;

  const todayDayMeta: TodayDayMeta | null = selectedDay
    ? {
        cityLabel: selectedDay.cityLabel,
        tripName,
        weather: selectedDay.weather,
        dateISO: selectedDay.date,
        tripTimezone: timezone,
        isViewingToday,
        previewNightStay: nightStay ?? null,
      }
    : null;

  const previewCache = useMemo<TripCacheState>(
    () => ({
      tripId,
      participantId: null,
      version: 1,
      cachedAt: null,
      publishedAt: null,
      payload: null,
      online: true,
      sessionReady: true,
      status: "up_to_date",
      refresh: async () => {},
    }),
    [tripId],
  );

  const contextValue = useMemo(
    () => ({
      refresh: async () => {},
      refreshing: false,
      cache: previewCache,
      todayNav,
      setTodayNav: () => {},
      todayDayMeta,
      setTodayDayMeta: () => {},
      tripId,
      calendarOpen,
      setCalendarOpen,
      participantPhotos: [],
      refreshPhotos: async () => {},
    }),
    [previewCache, todayNav, todayDayMeta, tripId, calendarOpen],
  );

  return (
    <TripAppContext.Provider value={contextValue}>
      <div
        className={`${plusJakartaSans.variable} student-app flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden bg-[var(--student-bg)] text-[var(--student-text)]`}
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col gap-2 overflow-hidden px-4 py-3">
          {todayNav && todayDayMeta ? <TravelPassHeader /> : (
            <header className="shrink-0 border-b border-[var(--student-line)] pb-2 pt-0.5">
              <p className="text-center text-sm text-[var(--student-text-muted)]">No days yet</p>
            </header>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>

          <StudentBottomNav inviteCode={inviteCode} preview />
        </div>

        {todayNav ? (
          <DayCalendarSheet
            open={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            days={scheduledDays}
            selectedDateISO={todayNav.selectedDateISO}
            tripDates={{ startDate, endDate: endDate ?? startDate }}
            itemCountByDayId={itemCountByDayId}
            firstItemTitleByDayId={firstItemTitleByDayId}
            onSelectDate={setDate}
          />
        ) : null}
      </div>
    </TripAppContext.Provider>
  );
}
