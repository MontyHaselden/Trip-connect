"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useTripApp } from "@/components/layout/TripAppContext";
import {
  enableTripDebugPersisted,
  getTripDebugLog,
  installTripDebugGlobal,
  isTripDebugEnabled,
  tripDebug,
  type TripDebugEntry,
} from "@/lib/debug/trip-debug";
import {
  hasMyTripProfile,
  hasTodaySchedule,
  resolveStudentTripPayload,
} from "@/lib/student/resolve-trip-payload";

function payloadShape(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "none";
  const o = payload as Record<string, unknown>;
  const keys = [
    o.trip ? "trip" : null,
    o.participant ? "participant" : null,
    o.participants ? "participants[]" : null,
    o.days ? "days" : null,
    o.itineraryItems ? "items" : null,
  ].filter(Boolean);
  return keys.join(", ") || "unknown";
}

export function TripDebugPanel() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { cache } = useTripApp();
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [entries, setEntries] = useState<TripDebugEntry[]>(() => getTripDebugLog());

  useEffect(() => {
    installTripDebugGlobal();
    if (search.get("debug") === "1") {
      enableTripDebugPersisted();
      setEnabled(true);
      tripDebug("debug.enabled", { via: "query" });
      return;
    }
    setEnabled(isTripDebugEnabled());
  }, [search]);

  const trip = useMemo(
    () => resolveStudentTripPayload(cache.payload, cache.participantId),
    [cache.payload, cache.participantId],
  );

  useEffect(() => {
    tripDebug("route.change", { pathname });
  }, [pathname]);

  useEffect(() => {
    tripDebug("cache.update", {
      status: cache.status,
      sessionReady: cache.sessionReady,
      version: cache.version,
      tripId: cache.tripId,
      participantId: cache.participantId,
      payload: payloadShape(cache.payload),
      todayOk: hasTodaySchedule(trip),
      myTripOk: hasMyTripProfile(trip),
    });
  }, [
    cache.status,
    cache.sessionReady,
    cache.version,
    cache.tripId,
    cache.participantId,
    cache.payload,
    trip,
  ]);

  useEffect(() => {
    function onDebug(ev: Event) {
      const detail = (ev as CustomEvent<TripDebugEntry>).detail;
      if (!detail) return;
      setEntries((prev) => [detail, ...prev].slice(0, 20));
    }
    window.addEventListener("tc-debug", onDebug);
    return () => window.removeEventListener("tc-debug", onDebug);
  }, []);

  if (!enabled) return null;

  return (
    <div className="shrink-0 border-t border-amber-300 bg-amber-50 text-amber-950">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide"
      >
        <span>Trip debug</span>
        <span>{expanded ? "Hide" : "Show"}</span>
      </button>

      {expanded ? (
        <div className="max-h-36 space-y-1 overflow-y-auto border-t border-amber-200 px-3 py-2 font-mono text-[10px] leading-relaxed">
          <p>
            route={pathname} status={cache.status} session=
            {String(cache.sessionReady)} tripId={cache.tripId ?? "—"} participant=
            {cache.participantId ?? "—"}
          </p>
          <p>
            payload=[{payloadShape(cache.payload)}] today=
            {String(hasTodaySchedule(trip))} myTrip=
            {String(hasMyTripProfile(trip))}
          </p>
          {cache.message ? <p className="text-red-700">error={cache.message}</p> : null}
          {entries.map((e, i) => (
            <p key={`${e.t}-${e.event}-${i}`}>
              {e.t} {e.event}{" "}
              {Object.entries(e)
                .filter(([k]) => k !== "t" && k !== "event")
                .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                .join(" ")}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
