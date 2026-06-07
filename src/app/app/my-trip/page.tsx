"use client";

import { useEffect } from "react";

import {
  getStoredTripSession,
  resolveStudentAppLaunchPath,
} from "@/lib/mobile/trip-storage";

export default function LegacyMyTripLauncherPage() {
  useEffect(() => {
    window.location.replace(resolveStudentAppLaunchPath("my-trip"));
  }, []);

  const session = getStoredTripSession();
  if (!session) {
    return (
      <p className="p-6 text-center text-sm text-zinc-600">Loading trip…</p>
    );
  }

  return (
    <p className="p-6 text-center text-sm text-zinc-600">Loading trip…</p>
  );
}
