"use client";

import { useEffect } from "react";

import { resolveStudentAppLaunchPath } from "@/lib/mobile/trip-storage";

export default function LegacyCalendarLauncherPage() {
  useEffect(() => {
    window.location.replace(resolveStudentAppLaunchPath("today"));
  }, []);

  return (
    <p className="p-6 text-center text-sm text-zinc-600">Loading trip…</p>
  );
}
