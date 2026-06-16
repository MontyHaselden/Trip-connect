"use client";

import { useCallback, useState } from "react";

import type { SetupSectionId } from "@/lib/host/setup/types";
import { deserializeRenderModel } from "@/lib/trip-engine/build-setup-response";
import type {
  CalendarProjection,
  CalendarRenderModel,
  EngineConflict,
  EngineSectionReadiness,
  EngineWarning,
  SetupEngineResponse,
  TripEntityGraph,
} from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

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

export function useSetupEngine(tripId: string) {
  const [data, setData] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionId>("overview");
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
    if (!activeGroupId) setActiveGroupId(body.graph.mainGroupId);
  }, [activeGroupId]);

  const load = useCallback(
    async (groupId?: string) => {
      setLoading(true);
      setError(null);
      try {
        const gid = groupId ?? activeGroupId;
        const qs = new URLSearchParams({ engine: "1" });
        if (gid) qs.set("groupId", gid);
        const res = await fetch(`/api/trips/${tripId}/setup?${qs}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Failed to load setup");
        applyResponse(body);
        if (!activeGroupId) setActiveGroupId(body.graph.mainGroupId);
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
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Command failed");
        applyResponse(body);
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
    selectedDate,
    setSelectedDate,
    load,
    dispatch,
    switchGroup,
  };
}
