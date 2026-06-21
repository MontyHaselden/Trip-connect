"use client";

import { useCallback, useState } from "react";

import type { SetupSectionId } from "@/lib/host/setup/types";
import { deserializeRenderModel } from "@/lib/trip-engine/build-setup-response";
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
    async (commands: TripCommand[]) => {
      if (!data) return false;

      const optimistic = applyCommands(data.graph, commands);
      setData((prev) =>
        prev
          ? {
              ...prev,
              graph: optimistic.graph,
              warnings: optimistic.warnings,
              conflicts: optimistic.conflicts ?? [],
            }
          : prev,
      );

      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/trips/${tripId}/setup/commands`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            commands,
            groupId: activeGroupId || data.graph.mainGroupId,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        } & Partial<SetupEngineResponse>;
        if (!res.ok) throw new Error(body.error || "Command failed");
        if (body.graph) {
          applyResponse(body as SetupEngineResponse);
        } else {
          await load(activeGroupId || data.graph.mainGroupId, { silent: true });
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tripId, data, activeGroupId, applyResponse, load],
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
