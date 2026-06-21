"use client";

import { useCallback, useRef, useState } from "react";

import type { SetupSectionId } from "@/lib/host/setup/types";
import { deriveEngineViewFromGraph, deserializeRenderModel } from "@/lib/trip-engine/build-setup-response";
import { applyCommands } from "@/lib/trip-engine/apply-commands";
import type { TripCommand } from "@/lib/trip-engine/commands";
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

function deserializeProjection(raw: SetupEngineResponse["calendarProjection"]): CalendarProjection {
  const accom =
    raw.accommodationByDate instanceof Map
      ? raw.accommodationByDate
      : new Map(Object.entries(raw.accommodationByDate as Record<string, string>));
  return { ...raw, accommodationByDate: accom };
}

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
  const persistQueueRef = useRef(Promise.resolve(true));
  const inFlightCountRef = useRef(0);

  const bumpSaving = useCallback((delta: number) => {
    inFlightCountRef.current += delta;
    setSaving(inFlightCountRef.current > 0);
  }, []);

  const applyResponse = useCallback((body: SetupEngineResponse & { inviteCode?: string }) => {
    setData((prev) => ({
      graph: body.graph,
      calendarProjection: deserializeProjection(body.calendarProjection),
      calendarRenderModel: deserializeRenderModel(body.calendarRenderModel),
      readiness: body.readiness,
      warnings: body.warnings,
      conflicts: body.conflicts,
      inviteCode: body.inviteCode ?? prev?.inviteCode ?? "",
      rosterSummary:
        body.rosterSummary ??
        prev?.rosterSummary ??
        { participants: [], groups: [], rooms: [] },
      costLedger: body.costLedger !== undefined ? body.costLedger : (prev?.costLedger ?? null),
    }));
    setActiveGroupId((current) => current || body.graph.mainGroupId);
  }, []);

  const load = useCallback(
    async (groupId?: string, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const gid = groupId ?? activeGroupId;
        const qs = new URLSearchParams({ engine: "1" });
        if (gid) qs.set("groupId", gid);
        const res = await fetch(`/api/trips/${tripId}/setup?${qs}`);
        const body = (await res.json().catch(() => ({}))) as { error?: string } & SetupEngineResponse;
        if (!res.ok) throw new Error(body.error || "Failed to load setup");
        applyResponse(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [tripId, activeGroupId, applyResponse],
  );

  const dispatch = useCallback(
    (commands: TripCommand[]): Promise<boolean> => {
      if (!dataRef.current) return Promise.resolve(false);

      setData((prev) => {
        if (!prev) return prev;
        const optimistic = applyCommands(prev.graph, commands);
        const groupId = activeGroupIdRef.current || prev.graph.mainGroupId;
        const view = deriveEngineViewFromGraph(optimistic.graph, {
          groupId,
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
      bumpSaving(1);

      const persist = async (): Promise<boolean> => {
        const groupId =
          activeGroupIdRef.current || dataRef.current?.graph.mainGroupId || "";
        try {
          const res = await fetch(`/api/trips/${tripId}/setup/commands`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ commands, groupId }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          } & Partial<SetupEngineResponse>;
          if (!res.ok) throw new Error(body.error || "Command failed");
          if (body.graph) {
            applyResponse(body as SetupEngineResponse);
          } else {
            await load(groupId, { silent: true });
          }
          return true;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Save failed");
          await load(groupId, { silent: true });
          return false;
        } finally {
          bumpSaving(-1);
        }
      };

      const resultPromise = persistQueueRef.current.then(persist, persist);
      persistQueueRef.current = resultPromise.then(
        () => true,
        () => true,
      );
      return resultPromise;
    },
    [tripId, applyResponse, load, bumpSaving],
  );

  const switchGroup = useCallback(
    async (groupId: string) => {
      setActiveGroupId(groupId);
      await load(groupId, { silent: Boolean(data) });
    },
    [load, data],
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
