"use client";

import { useCallback, useState } from "react";

import type { SetupSectionId } from "@/lib/host/setup/types";
import { deserializeRenderModel } from "@/lib/trip-engine/build-setup-response";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type {
  CalendarProjection,
  CalendarRenderModel,
  EngineConflict,
  EngineSectionReadiness,
  EngineWarning,
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionId>("overview");
  const [activeGroupId, setActiveGroupId] = useState<string>("");

  const applyResponse = useCallback((body: SetupEngineResponse & { inviteCode?: string }) => {
    setData({
      graph: body.graph,
      calendarProjection: deserializeProjection(body.calendarProjection),
      calendarRenderModel: deserializeRenderModel(body.calendarRenderModel),
      readiness: body.readiness,
      warnings: body.warnings,
      conflicts: body.conflicts,
      inviteCode: body.inviteCode ?? "",
    });
    setActiveGroupId((current) => current || body.graph.mainGroupId);
  }, []);

  const load = useCallback(
    async (groupId?: string) => {
      setLoading(true);
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
        setLoading(false);
      }
    },
    [tripId, activeGroupId, applyResponse],
  );

  const dispatch = useCallback(
    async (commands: TripCommand[]) => {
      if (!data) return false;
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
        if (!body.graph) throw new Error("Server returned an incomplete response.");
        applyResponse(body as SetupEngineResponse);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tripId, data, activeGroupId, applyResponse],
  );

  const switchGroup = useCallback(
    async (groupId: string) => {
      setActiveGroupId(groupId);
      await load(groupId);
    },
    [load],
  );

  return {
    data,
    loading,
    saving,
    error,
    activeSection,
    setActiveSection,
    activeGroupId,
    load,
    dispatch,
    switchGroup,
  };
}
