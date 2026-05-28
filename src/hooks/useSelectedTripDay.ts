"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";

type Day = { id: string; date: string; cityLabel: string; sortOrder: number };

export function useSelectedTripDay(days: Day[], tripTimezone: string) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const dateParam = search.get("date");

  const daysByDate = useMemo(() => {
    const m = new Map<string, Day>();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const todayISO = useMemo(() => {
    return DateTime.now().setZone(tripTimezone).toISODate();
  }, [tripTimezone]);

  const selected = useMemo(() => {
    if (dateParam && daysByDate.has(dateParam)) return daysByDate.get(dateParam)!;
    if (todayISO && daysByDate.has(todayISO)) return daysByDate.get(todayISO)!;
    return [...days].sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
  }, [dateParam, days, daysByDate, todayISO]);

  function setDate(dateISO: string) {
    const params = new URLSearchParams(search.toString());
    params.set("date", dateISO);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function goToday() {
    if (todayISO) setDate(todayISO);
  }

  function goTomorrow() {
    if (!selected) return;
    const dt = DateTime.fromISO(selected.date, { zone: tripTimezone }).plus({ days: 1 });
    const iso = dt.toISODate();
    if (iso && daysByDate.has(iso)) setDate(iso);
  }

  function goNext() {
    if (!selected) return;
    const sorted = [...days].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((d) => d.id === selected.id);
    const next = sorted[idx + 1];
    if (next) setDate(next.date);
  }

  return {
    selectedDay: selected,
    setDate,
    goToday,
    goTomorrow,
    goNext,
  };
}

