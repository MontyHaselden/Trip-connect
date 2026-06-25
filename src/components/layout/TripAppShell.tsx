"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { ParticipantPhoto } from "@/lib/student/participant-photos";

import { StudentBottomNav } from "./StudentBottomNav";
import { StudentUpdateToast } from "@/components/student/StudentUpdateToast";
import { TripAppContext, type TodayDayMeta, type TodayDayNav } from "./TripAppContext";
import { TripDayNavBridge } from "./TripDayNavBridge";
import { TripDebugPanel } from "@/components/debug/TripDebugPanel";
import { AddToHomeScreenHint } from "@/components/mobile/AddToHomeScreenHint";
import { TripPwaHead } from "@/components/mobile/TripPwaHead";
import { TravelPassHeader } from "@/components/student/TravelPassHeader";
import { DayCalendarSheet } from "@/components/student/today/DayCalendarSheet";
import { useTripCache } from "@/hooks/useTripCache";
import { useStudentViewportLock } from "@/hooks/useStudentViewportLock";
import { plusJakartaSans } from "@/lib/fonts/student-font";
import { installTripDebugGlobal, tripDebug } from "@/lib/debug/trip-debug";
import { isStandaloneDisplayMode } from "@/lib/mobile/pwa-detect";
import {
  INSTALL_HINT_SESSION_KEY,
  STUDENT_APP_LAUNCH_PATH,
  studentAppPath,
} from "@/lib/mobile/trip-storage";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

export function TripAppShell({
  children,
  tripId,
  inviteCode,
}: {
  children: React.ReactNode;
  tripId: string;
  inviteCode?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const cache = useTripCache(tripId);
  useStudentViewportLock();
  const [refreshing, setRefreshing] = useState(false);
  const [todayNav, setTodayNavState] = useState<TodayDayNav | null>(null);
  const [todayDayMeta, setTodayDayMeta] = useState<TodayDayMeta | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [participantPhotos, setParticipantPhotos] = useState<ParticipantPhoto[]>([]);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const setTodayNav = useCallback((nav: TodayDayNav | null) => {
    setTodayNavState(nav);
  }, []);
  const setTodayDayMetaStable = useCallback((meta: TodayDayMeta | null) => {
    setTodayDayMeta(meta);
  }, []);

  const refreshPhotos = useCallback(async () => {
    if (!tripId) return;
    const token = localStorage.getItem("tc_access_token");
    if (!token) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/my-photos`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setParticipantPhotos(body.photos ?? []);
    } catch {
      // ignore
    }
  }, [tripId]);

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const onToday =
    pathname.includes("/today") || pathname.match(/^\/s\/[^/]+\/?$/) !== null;
  const onMyTrip = pathname.includes("/my-trip");
  const showTravelHeader = onToday && todayNav !== null;

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

  async function onRefresh() {
    setRefreshing(true);
    try {
      await cache.refresh();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isStandaloneDisplayMode()) return;
    try {
      if (sessionStorage.getItem(INSTALL_HINT_SESSION_KEY) === "1") {
        sessionStorage.removeItem(INSTALL_HINT_SESSION_KEY);
        setShowInstallHint(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    installTripDebugGlobal();
    tripDebug("shell.mount", { pathname, tripId });
  }, [pathname, tripId]);

  useEffect(() => {
    if (!cache.sessionReady || !tripId) return;
    refreshPhotos();
  }, [cache.sessionReady, tripId, refreshPhotos]);

  useEffect(() => {
    const storedTripId = localStorage.getItem("tc_trip_id");
    const token = localStorage.getItem("tc_access_token");
    const storedInvite = localStorage.getItem("tc_invite_code");
    const resolvedInvite = inviteCode ?? storedInvite;

    if (!token || !storedTripId) {
      if (resolvedInvite) {
        router.replace(studentAppPath(resolvedInvite));
      } else {
        router.replace(STUDENT_APP_LAUNCH_PATH);
      }
      return;
    }

    if (
      inviteCode &&
      storedInvite &&
      storedInvite !== inviteCode &&
      storedTripId !== tripId
    ) {
      return;
    }

    if (resolvedInvite && !pathname.startsWith(`/s/${resolvedInvite}`)) {
      const suffix = pathname.includes("/my-trip") ? "/my-trip" : "";
      const search = typeof window !== "undefined" ? window.location.search : "";
      router.replace(`${studentAppPath(resolvedInvite)}${suffix}${search}`);
      return;
    }

    if (storedTripId !== tripId && resolvedInvite) {
      router.replace(studentAppPath(resolvedInvite));
    }
  }, [router, tripId, inviteCode, pathname]);

  const pwaStartUrl = inviteCode ? studentAppPath(inviteCode) : undefined;

  return (
    <TripAppContext.Provider
      value={{
        refresh: onRefresh,
        refreshing,
        cache,
        todayNav,
        setTodayNav,
        todayDayMeta,
        setTodayDayMeta: setTodayDayMetaStable,
        tripId,
        calendarOpen,
        setCalendarOpen,
        participantPhotos,
        refreshPhotos,
      }}
    >
      {pwaStartUrl ? (
        <TripPwaHead
          tripName={trip?.trip.name ?? "Itinerary Live"}
          startUrl={pwaStartUrl}
          manifestId={pwaStartUrl}
        />
      ) : null}
      {showInstallHint ? (
        <AddToHomeScreenHint
          tripName={trip?.trip.name ?? "Itinerary Live"}
          onDismiss={() => setShowInstallHint(false)}
        />
      ) : null}
      <div
        className={`${plusJakartaSans.variable} student-app fixed inset-0 z-0 overflow-hidden`}
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col gap-2 overflow-hidden px-4 py-3">
          {showTravelHeader ? (
            <TravelPassHeader />
          ) : onMyTrip ? null : (
            <header className="shrink-0 border-b border-[var(--student-line)] pb-2 pt-0.5">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-[var(--student-text)]">
                  {trip?.trip.name ?? "Trip"}
                </h1>
              </div>
            </header>
          )}

          <TripDayNavBridge />
          <div key={pathname} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
          <Suspense fallback={null}>
            <TripDebugPanel />
          </Suspense>
          <StudentBottomNav inviteCode={inviteCode} />
        </div>
      </div>

      <StudentUpdateToast />

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
    </TripAppContext.Provider>
  );
}
