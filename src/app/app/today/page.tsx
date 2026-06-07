"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentAppLaunchPage() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const tripId = localStorage.getItem("tc_trip_id");
    const token = localStorage.getItem("tc_access_token");
    const inviteCode = localStorage.getItem("tc_invite_code");
    const search = window.location.search;

    if (tripId && token) {
      router.replace(`/trip/${tripId}/today${search}`);
      return;
    }
    if (inviteCode) {
      router.replace(`/join/${inviteCode}`);
      return;
    }

    setShowHelp(true);
  }, [router]);

  if (!showHelp) {
    return (
      <p className="p-6 text-center text-sm text-zinc-600">Loading trip…</p>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6 py-10">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-zinc-900">Trip Connect</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Open the invite link from your teacher to join, then add the app to your home
          screen from that page.
        </p>
      </div>
    </main>
  );
}
