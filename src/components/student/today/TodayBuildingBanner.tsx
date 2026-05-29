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
      <p className="border-b border-amber-200/80 bg-amber-50/80 px-0 py-2.5 text-xs leading-relaxed text-amber-950">
        AI is taking longer than expected. Open settings → Itinerary to check
        progress, or import manually.
      </p>
    );
  }

  return (
    <p className="border-b border-sky-200/80 bg-sky-50/80 px-0 py-2.5 text-xs leading-relaxed text-sky-950">
      <span className="font-medium">AI is building your trip…</span>{" "}
      {dayCount > 0
        ? `${dayCount} day${dayCount === 1 ? "" : "s"} added so far.`
        : "Usually 30–90 seconds."}
    </p>
  );
}
