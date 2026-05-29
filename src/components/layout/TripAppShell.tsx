"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { OfflineBanner } from "./OfflineBanner";
import { StudentBottomNav } from "./StudentBottomNav";
import { useTripCache } from "@/hooks/useTripCache";
import { clearStudentSessionAndCache } from "@/lib/offline/sync";

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

export function TripAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const cache = useTripCache();
  const [refreshing, setRefreshing] = useState(false);

  const tripName =
    cache.payload &&
    typeof cache.payload === "object" &&
    "trip" in cache.payload &&
    cache.payload.trip &&
    typeof cache.payload.trip === "object" &&
    "name" in cache.payload.trip
      ? String((cache.payload.trip as { name: string }).name)
      : "Trip";

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

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 px-5 py-4">
        <header className="flex items-center justify-between gap-3">
          <h1 className="truncate text-base font-semibold tracking-tight">
            {tripName}
          </h1>
          <Link
            href="/app/settings"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700"
            aria-label="Settings"
          >
            <SettingsIcon />
          </Link>
        </header>

        <OfflineBanner
          online={cache.online}
          cachedAt={cache.cachedAt}
          version={cache.version}
          onRefresh={onRefresh}
          refreshing={refreshing}
          status={
            cache.status === "updated" ||
            cache.status === "up_to_date" ||
            cache.status === "offline_no_cache" ||
            cache.status === "syncing" ||
            cache.status === "ready" ||
            cache.status === "error"
              ? cache.status
              : "ready"
          }
        />
        <div className="flex-1">{children}</div>
        <StudentBottomNav />
      </div>
    </div>
  );
}
