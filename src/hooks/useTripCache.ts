"use client";

import { useCallback, useEffect, useState } from "react";
import { getMeta, getPublishedTrip } from "@/lib/offline/trip-store";
import { syncPublishedTrip } from "@/lib/offline/sync";
import { useOnlineStatus } from "./useOnlineStatus";

export type TripCacheState = {
  tripId: string | null;
  participantId: string | null;
  version: number | null;
  cachedAt: string | null;
  publishedAt: string | null;
  payload: unknown | null;
  online: boolean;
  /** False until client session keys are read — avoids SSR hydration mismatch. */
  sessionReady: boolean;
  status:
    | "idle"
    | "loading_cache"
    | "ready"
    | "offline_no_cache"
    | "syncing"
    | "updated"
    | "up_to_date"
    | "unauthorized"
    | "error";
  message?: string;
  refresh: () => Promise<void>;
};

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useTripCache(): TripCacheState {
  const online = useOnlineStatus();
  const [sessionReady, setSessionReady] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [state, setState] = useState<Omit<TripCacheState, "refresh">>({
    tripId: null,
    participantId: null,
    version: null,
    cachedAt: null,
    publishedAt: null,
    payload: null,
    online,
    sessionReady: false,
    status: "idle",
  });

  useEffect(() => {
    setTripId(storageGet("tc_trip_id"));
    setParticipantId(storageGet("tc_participant_id"));
    setAccessToken(storageGet("tc_access_token"));
    setSessionReady(true);
  }, []);

  useEffect(() => {
    setState((s) => ({ ...s, tripId, participantId, sessionReady, online }));
  }, [tripId, participantId, sessionReady, online]);

  const refresh = useCallback(async () => {
    if (!tripId || !accessToken) return;
    setState((s) => ({ ...s, status: "syncing", online }));
    const res = await syncPublishedTrip({ tripId, accessToken, online: true });
    if (res.status === "unauthorized") {
      setState((s) => ({ ...s, status: "unauthorized", online }));
      return;
    }
    if (res.status === "offline_no_cache") {
      setState((s) => ({ ...s, status: "offline_no_cache", online }));
      return;
    }
    if (res.status === "error") {
      setState((s) => ({ ...s, status: "error", online, message: res.message }));
      return;
    }
    if (res.status === "updated" || res.status === "up_to_date") {
      const [meta, payload] = await Promise.all([
        getMeta(tripId),
        getPublishedTrip(tripId),
      ]);
      setState((s) => ({
        ...s,
        version: meta?.version ?? null,
        publishedAt: meta?.publishedAt ?? null,
        cachedAt: meta?.cachedAt ?? null,
        payload,
        online,
        status: res.status === "updated" ? "updated" : "up_to_date",
      }));
    }
  }, [tripId, accessToken, online]);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    async function loadCache() {
      if (!tripId) {
        setState((s) => ({ ...s, status: "offline_no_cache" }));
        return;
      }
      setState((s) => ({ ...s, status: "loading_cache" }));
      const [meta, payload] = await Promise.all([
        getMeta(tripId),
        getPublishedTrip(tripId),
      ]);
      if (cancelled) return;
      setState((s) => ({
        ...s,
        version: meta?.version ?? null,
        publishedAt: meta?.publishedAt ?? null,
        cachedAt: meta?.cachedAt ?? null,
        payload,
        status: payload ? "ready" : "offline_no_cache",
      }));
    }
    loadCache();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, tripId]);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    async function sync() {
      if (!tripId || !accessToken) return;
      setState((s) => ({ ...s, online, status: "syncing" }));
      try {
        const res = await syncPublishedTrip({ tripId, accessToken, online });
        if (cancelled) return;

        if (res.status === "unauthorized") {
          setState((s) => ({ ...s, status: "unauthorized", online }));
          return;
        }

        if (res.status === "offline_no_cache") {
          setState((s) => ({ ...s, status: "offline_no_cache", online }));
          return;
        }

        if (res.status === "error") {
          setState((s) => ({ ...s, status: "error", online, message: res.message }));
          return;
        }

        if (res.status === "updated" || res.status === "up_to_date") {
          const [meta, payload] = await Promise.all([
            getMeta(tripId),
            getPublishedTrip(tripId),
          ]);
          if (cancelled) return;
          setState((s) => ({
            ...s,
            version: meta?.version ?? null,
            publishedAt: meta?.publishedAt ?? null,
            cachedAt: meta?.cachedAt ?? null,
            payload,
            online,
            status: res.status === "updated" ? "updated" : "up_to_date",
          }));
        }
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          online,
          status: s.payload ? "ready" : "error",
          message: e instanceof Error ? e.message : "Sync failed",
        }));
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, tripId, accessToken, online]);

  return { ...state, refresh };
}
