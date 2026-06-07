"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LegacyMyTripRedirect() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const tripId = localStorage.getItem("tc_trip_id");
    const token = localStorage.getItem("tc_access_token");
    const inviteCode = localStorage.getItem("tc_invite_code");

    if (tripId && token) {
      router.replace(`/trip/${tripId}/my-trip`);
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
      <p className="max-w-sm text-center text-sm text-zinc-600">
        Open your trip invite link to sign in first.
      </p>
    </main>
  );
}
