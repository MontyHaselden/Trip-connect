"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function TodayBuildingBanner() {
  const searchParams = useSearchParams();
  const buildingParam = searchParams.get("building") === "1";
  const [building, setBuilding] = useState(buildingParam);
  const [dayCount, setDayCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  const inviteCode =
    typeof window !== "undefined"
      ? localStorage.getItem("tc_host_invite_code") ??
        localStorage.getItem("tc_invite_code")
      : null;

  useEffect(() => {
    if (!buildingParam && !building) return;
    if (!inviteCode) return;

    setBuilding(true);
    const started = Date.now();
    const maxMs = 4 * 60 * 1000;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/host/${encodeURIComponent(inviteCode)}/import-status`,
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          building: boolean;
          dayCount: number;
        };
        setDayCount(body.dayCount);
        if (!body.building && body.dayCount > 0) {
          setBuilding(false);
          window.clearInterval(interval);
        }
      } catch {
        // ignore poll errors
      }

      if (Date.now() - started > maxMs) {
        window.clearInterval(interval);
        setTimedOut(true);
        setBuilding(false);
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [building, buildingParam, inviteCode]);

  if (!building && !timedOut) return null;

  if (timedOut) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        AI is taking longer than expected. Open settings → Itinerary to check
        progress, or import your itinerary manually.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-950">
      <p className="font-medium">AI is building your trip…</p>
      <p className="mt-1">
        {dayCount > 0
          ? `${dayCount} day${dayCount === 1 ? "" : "s"} added so far.`
          : "This usually takes 30–90 seconds. Your itinerary will appear when ready."}
      </p>
    </section>
  );
}
