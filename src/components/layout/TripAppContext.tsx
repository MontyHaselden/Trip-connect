"use client";

import { createContext, useContext } from "react";

import type { TripCacheState } from "@/hooks/useTripCache";

export type TodayDayNav = {
  scheduledDays: Array<{
    id: string;
    date: string;
    cityLabel: string;
    sortOrder: number;
  }>;
  selectedDateISO: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrev: () => void;
  goNext: () => void;
  setDate: (dateISO: string) => void;
};

export type TripAppContextValue = {
  refresh: () => Promise<void>;
  refreshing: boolean;
  cache: TripCacheState;
  todayNav: TodayDayNav | null;
  setTodayNav: (nav: TodayDayNav | null) => void;
  calendarOpen: boolean;
  setCalendarOpen: (open: boolean) => void;
};

export const TripAppContext = createContext<TripAppContextValue | null>(null);

export function useTripApp() {
  const ctx = useContext(TripAppContext);
  if (!ctx) throw new Error("useTripApp must be used within TripAppShell");
  return ctx;
}
