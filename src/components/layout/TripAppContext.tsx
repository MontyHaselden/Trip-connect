"use client";

import { createContext, useContext } from "react";

import type { TripCacheState } from "@/hooks/useTripCache";

export type TripAppContextValue = {
  refresh: () => Promise<void>;
  refreshing: boolean;
  cache: TripCacheState;
};

export const TripAppContext = createContext<TripAppContextValue | null>(null);

export function useTripApp() {
  const ctx = useContext(TripAppContext);
  if (!ctx) throw new Error("useTripApp must be used within TripAppShell");
  return ctx;
}
