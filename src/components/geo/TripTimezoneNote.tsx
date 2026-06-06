"use client";

import { useEffect, useState } from "react";

type TimezoneDisplay = {
  iana: string;
  label: string;
  shortAbbr: string;
  homeAbbr: string;
  isHome: boolean;
};

export function TripTimezoneNote({
  countries,
  cities,
  departureCity,
  currentTimezone,
  onTimezoneResolved,
}: {
  countries: string[];
  cities: string[];
  departureCity: string;
  currentTimezone?: string;
  onTimezoneResolved?: (iana: string) => void;
}) {
  const [display, setDisplay] = useState<TimezoneDisplay | null>(null);
  const [loading, setLoading] = useState(false);

  const key = [countries.join("|"), cities.join("|"), departureCity].join(";");

  useEffect(() => {
    const hasSignal =
      countries.length > 0 || cities.some((c) => c.trim()) || departureCity.trim();
    if (!hasSignal) {
      setDisplay(null);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/geo/timezone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ countries, cities, departureCity }),
        });
        if (!res.ok) return;
        const body = await res.json();
        setDisplay(body.display as TimezoneDisplay);
        if (body.timezone && body.timezone !== currentTimezone) {
          onTimezoneResolved?.(body.timezone as string);
        }
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [key, currentTimezone, onTimezoneResolved]);

  if (!countries.length && !cities.some((c) => c.trim()) && !departureCity.trim()) {
    return (
      <p className="text-xs text-zinc-500">
        Time zone will be set automatically once you add countries or cities.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
      <p className="font-medium text-zinc-900">Trip time zone</p>
      {loading && !display ? (
        <p className="mt-1 text-xs text-zinc-500">Working out local time…</p>
      ) : display ? (
        <>
          <p className="mt-1">{display.label}</p>
          {!display.isHome ? (
            <p className="mt-1 text-xs text-zinc-500">
              Home ({display.homeAbbr}) and trip local ({display.shortAbbr}) times may differ
              on the itinerary.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">Could not detect time zone yet.</p>
      )}
    </div>
  );
}
