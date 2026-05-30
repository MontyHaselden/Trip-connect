"use client";

import { useEffect, useState } from "react";

import { getNowMinutes } from "@/lib/timeline/time-math";

export function useNowLine(params: {
  dateISO: string;
  tripTimezone: string;
  enabled: boolean;
  tickMs?: number;
}) {
  const { dateISO, tripTimezone, enabled, tickMs = 60_000 } = params;
  const [nowMinutes, setNowMinutes] = useState<number | null>(() =>
    enabled ? getNowMinutes(tripTimezone, dateISO) : null,
  );

  useEffect(() => {
    if (!enabled) {
      setNowMinutes(null);
      return;
    }
    function tick() {
      setNowMinutes(getNowMinutes(tripTimezone, dateISO));
    }
    tick();
    const id = window.setInterval(tick, tickMs);
    return () => window.clearInterval(id);
  }, [enabled, dateISO, tripTimezone, tickMs]);

  return nowMinutes;
}
