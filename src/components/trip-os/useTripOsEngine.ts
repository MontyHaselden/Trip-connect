"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SetupSectionId } from "@/lib/host/setup/types";
import {
  enqueueTripPersist,
  tripPersistInFlight,
  waitForTripPersist,
} from "@/lib/trip-os/persist-queue";
import { deriveEngineViewFromGraph } from "@/lib/trip-engine/build-setup-response";
import { applyCommands } from "@/lib/trip-engine/apply-commands";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { groupIdFromCommands } from "@/lib/trip-engine/persist-command";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type {
  CalendarProjection,
  CalendarRenderModel,
  EngineConflict,
  EngineSectionReadiness,
  EngineWarning,
  RosterSummary,
  SetupEngineResponse,
  TripEntityGraph,
} from "@/lib/trip-engine/types";

type EngineState = {
  graph: TripEntityGraph;
  calendarProjection: CalendarProjection;
  calendarRenderModel: CalendarRenderModel;
  readiness: EngineSectionReadiness[];
  warnings: EngineWarning[];
  conflicts: EngineConflict[];
  inviteCode: string;
  rosterSummary: RosterSummary;
  costLedger: CostLedgerProjection | null;
};

export function useTripOsEngine(tripId: string) {
  const [data, setData] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionId>("overview");
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const dataRef = useRef(data);
  dataRef.current = data;
  const activeGroupIdRef = useRef(activeGroupId);
  activeGroupIdRef.current = activeGroupId;
  const inFlightCountRef = useRef(0);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (inFlightCountRef.current > 0 || tripPersistInFlight(tripId)) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [tripId]);

  const bumpSaving = useCallback((delta: number) => {
    inFlightCountRef.current += delta;
    setSaving(inFlightCountRef.current > 0);
  }, []);

  const applyResponse = useCallback(
    (
      body: SetupEngineResponse & { inviteCode?: string },
      context?: { viewGroupId?: string },
    ) => {
      const viewGroupId =
        context?.viewGroupId ?? activeGroupIdRef.current ?? body.graph.mainGroupId;
      const view = deriveEngineViewFromGraph(body.graph, {
        groupId: viewGroupId,
        costLedger: dataRef.current?.costLedger ?? null,
      });
      setActiveGroupId(viewGroupId);
      setData((prev) => ({
        graph: view.graph,
        calendarProjection: view.calendarProjection,
        calendarRenderModel: view.calendarRenderModel,
        readiness: view.readiness,
        warnings: body.warnings,
        conflicts: view.conflicts,
        inviteCode: body.inviteCode ?? prev?.inviteCode ?? "",
        rosterSummary:
          body.rosterSummary ??
          prev?.rosterSummary ??
          { participants: [], groups: [], rooms: [] },
        costLedger: body.costLedger !== undefined ? body.costLedger : (prev?.costLedger ?? null),
      }));
    },
    [],
  );

  const load = useCallback(
    async (groupId?: string, options?: { silent?: boolean }) => {
      const generation = ++loadGenerationRef.current;
      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        await waitForTripPersist(tripId);
        if (generation !== loadGenerationRef.current) return;
        const gid = groupId ?? activeGroupIdRef.current;
        const qs = new URLSearchParams({ engine: "1" });
        if (gid) qs.set("groupId", gid);
        const res = await fetch(`/api/trips/${tripId}/setup?${qs}`);
        const body = (await res.json().catch(() => ({}))) as { error?: string } & SetupEngineResponse;
        if (generation !== loadGenerationRef.current) return;
        if (!res.ok) throw new Error(body.error || "Failed to load setup");
        applyResponse(body, {
          viewGroupId: gid ?? body.graph.mainGroupId,
        });
      } catch (e) {
        if (generation !== loadGenerationRef.current) return;
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (generation !== loadGenerationRef.current) return;
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [tripId, applyResponse],
  );

  const dispatch = useCallback(
    (commands: TripCommand[]): Promise<boolean> => {
      if (!dataRef.current) return Promise.resolve(false);

      const viewGroupId =
        activeGroupIdRef.current || dataRef.current.graph.mainGroupId;
      const persistGroupId =
        groupIdFromCommands(commands) ?? viewGroupId;

      setData((prev) => {
        if (!prev) return prev;
        const optimistic = applyCommands(prev.graph, commands);
        const view = deriveEngineViewFromGraph(optimistic.graph, {
          groupId: viewGroupId,
          costLedger: prev.costLedger,
        });
        return {
          ...prev,
          graph: view.graph,
          calendarProjection: view.calendarProjection,
          calendarRenderModel: view.calendarRenderModel,
          readiness: view.readiness,
          conflicts: view.conflicts,
          warnings: optimistic.warnings,
        };
      });

      setError(null);

      return enqueueTripPersist(tripId, async () => {
        bumpSaving(1);
        try {
          const res = await fetch(`/api/trips/${tripId}/setup/commands`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ commands, groupId: persistGroupId }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          } & Partial<SetupEngineResponse>;
          if (!res.ok) throw new Error(body.error || "Command failed");
          if (body.graph) {
            applyResponse(body as SetupEngineResponse, {
              viewGroupId: activeGroupIdRef.current || persistGroupId,
            });
          } else {
            await load(activeGroupIdRef.current || persistGroupId, { silent: true });
          }
          return true;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
          await load(activeGroupIdRef.current || persistGroupId, { silent: true });
          return false;
        } finally {
          bumpSaving(-1);
        }
      });
    },
    [tripId, applyResponse, load, bumpSaving],
  );

  const switchGroup = useCallback(
    async (groupId: string) => {
      if (tripPersistInFlight(tripId) || inFlightCountRef.current > 0) {
        await waitForTripPersist(tripId);
      }
      setActiveGroupId(groupId);
      await load(groupId, { silent: Boolean(data) });
    },
    [load, data, tripId],
  );

  const patchCosts = useCallback(
    async (payload: Record<string, unknown>) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/trips/${tripId}/costs`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          costLedger?: CostLedgerProjection;
        };
        if (!res.ok) throw new Error(body.error || "Costs update failed");
        if (body.costLedger) {
          setData((prev) => (prev ? { ...prev, costLedger: body.costLedger! } : prev));
        } else {
          await load(activeGroupId || data?.graph.mainGroupId, { silent: true });
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Costs update failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tripId, activeGroupId, data?.graph.mainGroupId, load],
  );

  return {
    data,
    loading,
    refreshing,
    saving,
    error,
    activeSection,
    setActiveSection,
    activeGroupId,
    load,
    dispatch,
    switchGroup,
    patchCosts,
  };
}
