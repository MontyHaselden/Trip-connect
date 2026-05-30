"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { OfflineBanner } from "./OfflineBanner";
import { StudentBottomNav } from "./StudentBottomNav";
import { TripAppContext, type TodayDayNav } from "./TripAppContext";
import { TripDebugPanel } from "@/components/debug/TripDebugPanel";
import { useTripCache } from "@/hooks/useTripCache";
import { clearStudentSessionAndCache } from "@/lib/offline/sync";
import { installTripDebugGlobal, tripDebug } from "@/lib/debug/trip-debug";
import { formatTripDateHeader } from "@/lib/utils/time";
import { resolveStudentTripPayload } from "@/lib/student/resolve-trip-payload";

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

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

export function TripAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const cache = useTripCache();
  const [refreshing, setRefreshing] = useState(false);
  const [todayNav, setTodayNav] = useState<TodayDayNav | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  const daySubtitle = useMemo(() => {
    if (!trip || !todayNav) return null;
    const selectedDay = todayNav.scheduledDays.find(
      (d) => d.date === todayNav.selectedDateISO,
    );
    if (!selectedDay) return null;
    const dateLine = formatTripDateHeader({
      dateISO: selectedDay.date,
      tripTimezone: trip.trip.timezone,
    });
    return selectedDay.cityLabel ? `${dateLine} - ${selectedDay.cityLabel}` : dateLine;
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
    installTripDebugGlobal();
    tripDebug("shell.mount", { pathname });
  }, [pathname]);

  useEffect(() => {
    const tripId = localStorage.getItem("tc_trip_id");
    const token = localStorage.getItem("tc_access_token");
    if (!tripId || !token) {
      const invite = localStorage.getItem("tc_invite_code");
      router.replace(invite ? `/join/${encodeURIComponent(invite)}` : "/");
    }
  }, [router]);

  useEffect(() => {
    if (cache.status === "unauthorized") {
      clearStudentSessionAndCache().finally(() => router.replace("/"));
    }
  }, [cache.status, router]);

  const bannerStatus =
    cache.status === "updated" ||
    cache.status === "up_to_date" ||
    cache.status === "offline_no_cache" ||
    cache.status === "syncing" ||
    cache.status === "ready" ||
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
        calendarOpen,
        setCalendarOpen,
      }}
    >
      <div className="h-dvh max-h-dvh overflow-hidden bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex h-full w-full max-w-md flex-col gap-3 overflow-hidden px-5 py-4">
          <header className="shrink-0 border-b border-zinc-200/80 pb-2 pt-0.5">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-sm font-semibold leading-tight tracking-tight text-zinc-900">
                  {trip?.trip.name ?? "Trip"}
                </h1>
                {daySubtitle ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-zinc-600">
                    {daySubtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={!cache.online || refreshing || cache.status === "syncing"}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600 disabled:opacity-40"
                aria-label="Refresh trip data"
              >
                <RefreshIcon spinning={refreshing || cache.status === "syncing"} />
              </button>
              <a
                href="/app/settings"
                onClick={() => tripDebug("nav.click", { to: "/app/settings", mode: "hard" })}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-zinc-600"
                aria-label="Settings"
              >
                <SettingsIcon />
              </a>
            </div>
          </header>

          <OfflineBanner
            online={cache.online}
            cachedAt={cache.cachedAt}
            version={cache.version}
            status={bannerStatus}
            message={cache.status === "error" ? cache.message : undefined}
          />
          <div
            key={pathname}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {children}
          </div>
          <Suspense fallback={null}>
            <TripDebugPanel />
          </Suspense>
          <StudentBottomNav />
        </div>
      </div>
    </TripAppContext.Provider>
  );
}
