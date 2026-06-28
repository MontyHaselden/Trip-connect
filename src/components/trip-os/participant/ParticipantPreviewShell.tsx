"use client";

import { useCallback, useMemo, useState } from "react";

import { TripAppContext, type TodayDayMeta, type TodayDayNav } from "@/components/layout/TripAppContext";
import { TripDayNavBridge } from "@/components/layout/TripDayNavBridge";
import { StudentBottomNav } from "@/components/layout/StudentBottomNav";
import { MyTripClient } from "@/components/student/my-trip/MyTripClient";
import { TravelPassDateHeader } from "@/components/student/TravelPassHeader";
import { StudentDayNavBar } from "@/components/student/StudentDayNavBar";
import { TodayClient } from "@/components/student/today/TodayClient";
import { DayCalendarSheet } from "@/components/student/today/DayCalendarSheet";
import { StudentOverlayProvider } from "@/components/student/StudentOverlayContext";
import type { TripCacheState } from "@/hooks/useTripCache";
import { plusJakartaSans } from "@/lib/fonts/student-font";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

export type ParticipantPreviewTab = "today" | "my-trip";

export function ParticipantPreviewShell(props: {
  tripId: string;
  inviteCode: string;
  participantId: string;
  version: number;
  publishedAt: string | null;
  payload: unknown | null;
  tab: ParticipantPreviewTab;
  onTabChange: (tab: ParticipantPreviewTab) => void;
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
}) {
  const {
    tripId,
    inviteCode,
    participantId,
    version,
    publishedAt,
    payload,
    tab,
    onTabChange,
    onRefresh,
    refreshing = false,
  } = props;

  const [todayNav, setTodayNav] = useState<TodayDayNav | null>(null);
  const [todayDayMeta, setTodayDayMeta] = useState<TodayDayMeta | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const cache = useMemo<TripCacheState>(
    () => ({
      tripId,
      participantId,
      version,
      cachedAt: new Date().toISOString(),
      publishedAt,
      payload,
      online: true,
      sessionReady: true,
      status: payload ? "up_to_date" : "ready",
      refresh: onRefresh,
    }),
    [tripId, participantId, version, publishedAt, payload, onRefresh],
  );

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const showTravelHeader = tab === "today" && todayNav !== null;

  const itemCountByDayId = useMemo(() => {
    const m = new Map<string, number>();
    if (!trip) return m;
    for (const item of trip.itineraryItems) {
      m.set(item.tripDayId, (m.get(item.tripDayId) ?? 0) + 1);
    }
    return m;
  }, [trip]);

  const firstItemTitleByDayId = useMemo(() => {
    const m = new Map<string, string>();
    if (!trip || !todayNav) return m;
    for (const day of todayNav.scheduledDays) {
      const first = trip.itineraryItems
        .filter((i) => i.tripDayId === day.id)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
      if (first) m.set(day.id, first.title);
    }
    return m;
  }, [trip, todayNav]);

  const setTodayNavStable = useCallback((nav: TodayDayNav | null) => {
    setTodayNav(nav);
  }, []);

  const setTodayDayMetaStable = useCallback((meta: TodayDayMeta | null) => {
    setTodayDayMeta(meta);
  }, []);

  return (
    <StudentOverlayProvider contained>
      <TripAppContext.Provider
      value={{
        refresh: onRefresh,
        refreshing,
        cache,
        todayNav,
        setTodayNav: setTodayNavStable,
        todayDayMeta,
        setTodayDayMeta: setTodayDayMetaStable,
        tripId,
        calendarOpen,
        setCalendarOpen,
        participantPhotos: [],
        refreshPhotos: async () => {},
      }}
    >
      <div
        className={`${plusJakartaSans.variable} student-app relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--student-bg)] text-[var(--student-text)]`}
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col gap-2 overflow-hidden px-4 py-3">
          {showTravelHeader ? (
            <TravelPassDateHeader />
          ) : tab === "my-trip" ? null : (
            <header className="shrink-0 border-b border-[var(--student-line)] pb-2 pt-0.5">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-[var(--student-text)]">
                  {trip?.trip.name ?? "Trip"}
                </h1>
              </div>
            </header>
          )}

          <TripDayNavBridge />

          <div key={tab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {tab === "today" ? <TodayClient /> : <MyTripClient />}
          </div>

          {showTravelHeader ? <StudentDayNavBar /> : null}
          <StudentBottomNav
            inviteCode={inviteCode}
            preview
            embeddedTab={tab}
            onEmbeddedTabChange={onTabChange}
          />
        </div>

        {showTravelHeader && todayNav ? (
          <DayCalendarSheet
            open={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            days={todayNav.scheduledDays}
            selectedDateISO={todayNav.selectedDateISO}
            tripDates={{
              startDate: todayNav.tripStartDate,
              endDate: todayNav.tripEndDate,
            }}
            itemCountByDayId={itemCountByDayId}
            firstItemTitleByDayId={firstItemTitleByDayId}
            onSelectDate={todayNav.setDate}
          />
        ) : null}
      </div>
    </TripAppContext.Provider>
    </StudentOverlayProvider>
  );
}
