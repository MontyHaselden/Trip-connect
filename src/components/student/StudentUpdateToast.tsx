"use client";

import { useEffect, useState } from "react";

import { useTripApp } from "@/components/layout/TripAppContext";

export function StudentUpdateToast() {
  const { cache } = useTripApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (cache.status !== "updated") return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [cache.status, cache.version, cache.cachedAt]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[65] flex justify-center px-4"
      style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}
      role="status"
      aria-live="polite"
    >
      <p className="rounded-full bg-[var(--student-nav)] px-4 py-2 text-sm font-semibold text-white shadow-lg">
        Trip updated.
      </p>
    </div>
  );
}
