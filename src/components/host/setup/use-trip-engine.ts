"use client";

import { useCallback, useState } from "react";

import { applyCommands } from "@/lib/trip-engine/apply-commands";
import { graphToSetupState, setupStateToGraph } from "@/lib/trip-engine/adapters";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import type { TripSetupState } from "@/lib/host/setup/types";

export function useTripEngine(tripId: string) {
  const [graph, setGraph] = useState<TripEntityGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/setup`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load setup");
    const state = body.state as TripSetupState;
    setGraph(setupStateToGraph(tripId, state));
  }, [tripId]);

  const dispatch = useCallback(
    (commands: TripCommand[], options?: { persist?: boolean; activeGroupId?: string }) => {
      setGraph((current) => {
        if (!current) return current;
        const result = applyCommands(current, commands);
        if (options?.persist) {
          void saveGraph(result.graph, options.activeGroupId);
        }
        return result.graph;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripId],
  );

  const saveGraph = useCallback(
    async (next?: TripEntityGraph, activeGroupId?: string): Promise<boolean> => {
      const raw = next ?? graph;
      if (!raw) return false;
      const payload = syncTripBoundsFromContent(graphToSetupState(raw));
      if (tripNameNeedsAttention(payload.basics.name)) {
        setError("Give this trip a real name before saving.");
        return false;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/trips/${tripId}/setup`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            state: payload,
            activeGroupId,
            skipWizardItineraryItems: true,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Save failed");
        setGraph(setupStateToGraph(tripId, payload));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [graph, tripId],
  );

  const dispatchAndSave = useCallback(
    async (commands: TripCommand[], activeGroupId?: string) => {
      if (!graph) return false;
      const result = applyCommands(graph, commands);
      setGraph(result.graph);
      return saveGraph(result.graph, activeGroupId);
    },
    [graph, saveGraph],
  );

  const applyCommandBatch = useCallback(
    async (commands: TripCommand[], activeGroupId?: string) => {
      const res = await fetch(`/api/trips/${tripId}/setup/commands`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commands, activeGroupId, persist: true, source: "manual" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Command failed");
      setGraph(body.graph as TripEntityGraph);
      return body;
    },
    [tripId],
  );

  const setState = useCallback(
    (state: TripSetupState) => {
      setGraph(setupStateToGraph(tripId, syncTripBoundsFromContent(state)));
    },
    [tripId],
  );

  const state = graph ? graphToSetupState(graph) : null;

  return {
    graph,
    state,
    setGraph,
    setState,
    load,
    loading,
    setLoading,
    saving,
    error,
    setError,
    dispatch,
    dispatchAndSave,
    applyCommandBatch,
    saveGraph,
  };
}
