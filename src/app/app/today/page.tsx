"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { isStandaloneDisplayMode } from "@/lib/mobile/pwa-detect";
import { studentJoinPath } from "@/lib/mobile/trip-storage";

function StudentAppLaunchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const tripId = localStorage.getItem("tc_trip_id");
    const token = localStorage.getItem("tc_access_token");
    const inviteCode =
      localStorage.getItem("tc_invite_code") ?? searchParams.get("invite");
    const search = window.location.search;

    if (tripId && token) {
      router.replace(`/trip/${tripId}/today${search}`);
      return;
    }
    if (inviteCode) {
      router.replace(studentJoinPath(inviteCode));
      return;
    }

    setShowHelp(true);
  }, [router, searchParams]);

  if (!showHelp) {
    return (
      <p className="p-6 text-center text-sm text-zinc-600">Loading trip…</p>
    );
  }

  const inApp = isStandaloneDisplayMode();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6 py-10">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-zinc-900">Trip Connect</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {inApp
            ? "This home screen icon needs your trip invite link. Open the link from your teacher in Safari, join, then add to home screen from that join page."
            : "Open the invite link from your teacher to join, then add the app to your home screen from that page."}
        </p>
      </div>
    </main>
  );
}

export default function StudentAppLaunchPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-center text-sm text-zinc-600">Loading trip…</p>
      }
    >
      <StudentAppLaunchContent />
    </Suspense>
  );
}
