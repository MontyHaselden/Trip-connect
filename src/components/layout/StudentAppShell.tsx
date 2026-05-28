"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OfflineBanner } from "./OfflineBanner";
import { useTripCache } from "@/hooks/useTripCache";
import { clearStudentSessionAndCache } from "@/lib/offline/sync";

export function StudentAppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const cache = useTripCache();

  useEffect(() => {
    // Guard: must have tripId + token to use /app/*
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
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-5 py-4">
        <OfflineBanner
          online={cache.online}
          cachedAt={cache.cachedAt}
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
        {children}
      </div>
    </div>
  );
}

