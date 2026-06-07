"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  getStoredInviteCode,
  getStoredTripSession,
  studentAppPath,
} from "@/lib/mobile/trip-storage";

function StudentAppLaunchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const session = getStoredTripSession();
    const inviteCode =
      session?.inviteCode ??
      getStoredInviteCode() ??
      searchParams.get("invite");
    const search = window.location.search;

    if (session?.accessToken && inviteCode) {
      router.replace(`${studentAppPath(inviteCode)}${search}`);
      return;
    }
    if (inviteCode) {
      router.replace(`${studentAppPath(inviteCode)}${search}`);
      return;
    }

    setShowHelp(true);
  }, [router, searchParams]);

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
          Open the invite link from your teacher to join your trip app.
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
