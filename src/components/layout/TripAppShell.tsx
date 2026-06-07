"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DateTime } from "luxon";

import type { ParticipantPhoto } from "@/lib/student/participant-photos";

import { OfflineBanner } from "./OfflineBanner";
import { StudentBottomNav } from "./StudentBottomNav";
import { TripAppContext, type TodayDayNav } from "./TripAppContext";
import { TripDayNavBridge } from "./TripDayNavBridge";
import { TripDebugPanel } from "@/components/debug/TripDebugPanel";
import { AddToHomeScreenHint } from "@/components/mobile/AddToHomeScreenHint";
import { TripPwaHead } from "@/components/mobile/TripPwaHead";
import { DayCalendarSheet } from "@/components/student/today/DayCalendarSheet";
import { DayLocationButton } from "@/components/student/today/DayLocationSheet";
import { useTripCache } from "@/hooks/useTripCache";
import { installTripDebugGlobal, tripDebug } from "@/lib/debug/trip-debug";
import { isStandaloneDisplayMode } from "@/lib/mobile/pwa-detect";
import {
  INSTALL_HINT_SESSION_KEY,
  STUDENT_APP_LAUNCH_PATH,
  studentAppPath,
} from "@/lib/mobile/trip-storage";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["h-5 w-5", spinning ? "animate-spin" : ""].join(" ")}
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

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
  const [refreshing, setRefreshing] = useState(false);
  const [todayNav, setTodayNavState] = useState<TodayDayNav | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [participantPhotos, setParticipantPhotos] = useState<ParticipantPhoto[]>([]);
  const [showInstallHint, setShowInstallHint] = useState(false);
  const setTodayNav = useCallback((nav: TodayDayNav | null) => {
    setTodayNavState(nav);
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
      // ignore — gallery loads when back online
    }
  }, [tripId]);

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const onToday = pathname.includes("/today") || pathname.match(/^\/s\/[^/]+\/?$/) !== null;
  const showDayControls = onToday && todayNav !== null;

  const selectedDay = useMemo(() => {
    if (!todayNav) return null;
    return todayNav.scheduledDays.find((d) => d.date === todayNav.selectedDateISO) ?? null;
  }, [todayNav]);

  const centredHeaderDateLine = useMemo(() => {
    if (!showDayControls || !selectedDay || !trip) return null;
    const dt = DateTime.fromISO(selectedDay.date, { zone: trip.trip.timezone });
    return dt.toFormat("cccc d LLLL");
  }, [showDayControls, selectedDay, trip]);

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

  const pwaStartUrl = inviteCode
    ? studentAppPath(inviteCode)
    : undefined;

  const bannerStatus =
    cache.status === "updated" ||
    cache.status === "up_to_date" ||
    cache.status === "offline_no_cache" ||
    cache.status === "syncing" ||
    cache.status === "ready" ||
    cache.status === "unauthorized" ||
    cache.status === "error"
      ? cache.status
      : "ready";

  return (
    <TripAppContext.Provider
      value={{
        refresh: onRefresh,
        refreshing,
        cache,
        todayNav,
        setTodayNav,
        tripId,
        calendarOpen,
        setCalendarOpen,
        participantPhotos,
        refreshPhotos,
      }}
    >
      {pwaStartUrl ? (
        <TripPwaHead
          tripName={trip?.trip.name ?? "Trip Connect"}
          startUrl={pwaStartUrl}
          manifestId={pwaStartUrl}
        />
      ) : null}
      {showInstallHint ? (
        <AddToHomeScreenHint
          tripName={trip?.trip.name ?? "Trip Connect"}
          onDismiss={() => setShowInstallHint(false)}
        />
      ) : null}
      <div className="h-dvh max-h-dvh overflow-hidden bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex h-full w-full max-w-md flex-col gap-2 overflow-hidden px-4 py-3">
          <header className="shrink-0 border-b border-zinc-200/80 pb-2 pt-0.5">
            {showDayControls && centredHeaderDateLine ? (
              <div className="text-center">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={todayNav!.goPrev}
                    disabled={!todayNav!.canGoPrev}
                    className="h-8 w-8 text-lg text-zinc-700 disabled:opacity-30"
                    aria-label="Previous day"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(true)}
                    className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    Calendar
                  </button>
                  <button
                    type="button"
                    onClick={todayNav!.goNext}
                    disabled={!todayNav!.canGoNext}
                    className="h-8 w-8 text-lg text-zinc-700 disabled:opacity-30"
                    aria-label="Next day"
                  >
                    ›
                  </button>
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <h1 className="text-lg font-semibold tracking-tight">
                    {centredHeaderDateLine}
                  </h1>
                  <DayLocationButton placement="header" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <h1 className="text-sm font-semibold">{trip?.trip.name ?? "Trip"}</h1>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={!cache.online || refreshing || cache.status === "syncing"}
                  className="inline-flex h-8 w-8 items-center justify-center text-zinc-600 disabled:opacity-40"
                  aria-label="Refresh"
                >
                  <RefreshIcon spinning={refreshing || cache.status === "syncing"} />
                </button>
              </div>
            )}
            {showDayControls ? (
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={!cache.online || refreshing || cache.status === "syncing"}
                  className="text-xs text-zinc-500 disabled:opacity-40"
                >
                  Refresh
                </button>
              </div>
            ) : null}
          </header>

          <OfflineBanner
            online={cache.online}
            cachedAt={cache.cachedAt}
            version={cache.version}
            status={bannerStatus}
            message={
              cache.status === "unauthorized"
                ? "Could not refresh — your session may have expired. You can still view saved trip data."
                : cache.status === "error"
                  ? cache.message
                  : undefined
            }
          />
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

      {showDayControls && todayNav ? (
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
