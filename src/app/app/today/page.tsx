"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  clearTripSession,
  getStoredInviteCode,
  getStoredTripSession,
  studentAppPath,
} from "@/lib/mobile/trip-storage";

async function inviteIsValid(inviteCode: string) {
  const res = await fetch(`/api/join/${encodeURIComponent(inviteCode)}/roster`);
  return res.ok;
}

function StudentAppLaunchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showHelp, setShowHelp] = useState(false);
  const [clearedStale, setClearedStale] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function launch() {
      const session = getStoredTripSession();
      const inviteFromQuery = searchParams.get("invite");
      const inviteCode =
        inviteFromQuery ??
        session?.inviteCode ??
        getStoredInviteCode();
      const search = window.location.search;

      if (!inviteCode) {
        if (!cancelled) setShowHelp(true);
        return;
      }

      const valid = await inviteIsValid(inviteCode);
      if (!valid) {
        clearTripSession();
        if (!cancelled) {
          setClearedStale(true);
          if (inviteFromQuery && inviteFromQuery !== inviteCode) {
            router.replace(`${studentAppPath(inviteFromQuery)}${search}`);
            return;
          }
          setShowHelp(true);
        }
        return;
      }

      if (!cancelled) {
        router.replace(`${studentAppPath(inviteCode)}${search}`);
      }
    }

    void launch();
    return () => {
      cancelled = true;
    };
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
          {clearedStale
            ? "An old trip link on this device was cleared. Open the current invite link from your organiser."
            : "Open the invite link from your teacher to join your trip app."}
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
