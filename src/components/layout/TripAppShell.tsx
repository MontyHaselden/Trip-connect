"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { OfflineBanner } from "./OfflineBanner";
import { StudentBottomNav } from "./StudentBottomNav";
import { TripAppContext } from "./TripAppContext";
import { useTripCache } from "@/hooks/useTripCache";
import { clearStudentSessionAndCache } from "@/lib/offline/sync";
import type { ParticipantFilteredTripV1 } from "@/lib/publish/filter-for-participant";

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

function isTripPayload(x: unknown): x is ParticipantFilteredTripV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as { trip?: unknown; participant?: unknown };
  return Boolean(o.trip && o.participant);
}

export function TripAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const cache = useTripCache();
  const [refreshing, setRefreshing] = useState(false);

  const trip = isTripPayload(cache.payload) ? cache.payload : null;

  const headerTitle = useMemo(() => {
    if (trip) {
      return `${trip.trip.schoolName} ${trip.trip.name}`.toLowerCase();
    }
    return "trip";
  }, [trip]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await cache.refresh();
    } finally {
      setRefreshing(false);
    }
  }

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
    <TripAppContext.Provider value={{ refresh: onRefresh, refreshing, cache }}>
      <div className="min-h-dvh bg-zinc-50 text-zinc-900">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 px-5 py-4">
          <header className="border-b border-zinc-200/80 pb-3">
            <div className="flex items-center gap-1">
              <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-zinc-800">
                {headerTitle}
              </h1>
              <button
                type="button"
                onClick={onRefresh}
                disabled={!cache.online || refreshing || cache.status === "syncing"}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-zinc-600 disabled:opacity-40"
                aria-label="Refresh trip data"
              >
                <RefreshIcon spinning={refreshing || cache.status === "syncing"} />
              </button>
              <Link
                href="/app/settings"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-zinc-600"
                aria-label="Settings"
              >
                <SettingsIcon />
              </Link>
            </div>
          </header>

          <OfflineBanner
            online={cache.online}
            cachedAt={cache.cachedAt}
            version={cache.version}
            status={bannerStatus}
            message={cache.status === "error" ? cache.message : undefined}
          />
          <div className="flex-1">{children}</div>
          <StudentBottomNav />
        </div>
      </div>
    </TripAppContext.Provider>
  );
}
