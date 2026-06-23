"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { SetupSectionId } from "@/lib/host/setup/types";
import {
  mergeTripLocalDraft,
  readTripLocalDraft,
  type TripLocalDraft,
} from "@/lib/trip-os/local-draft";
import {
  enqueueTripPersist,
  tripPersistInFlight,
  waitForTripPersist,
} from "@/lib/trip-os/persist-queue";
import { deriveEngineViewFromGraph } from "@/lib/trip-engine/build-setup-response";
import { applyCommands } from "@/lib/trip-engine/apply-commands";
import { computeReadiness } from "@/lib/trip-engine/compute-readiness";
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

export type TripSaveStatus = "idle" | "syncing" | "sync_error";

/** Debounce before background server sync — local draft is written immediately. */
const PERSIST_DEBOUNCE_MS = 400;
const PERSIST_RETRY_MS = 8000;

const EMPTY_ROSTER: RosterSummary = { participants: [], groups: [], rooms: [] };

export function useTripOsEngine(tripId: string) {
  const [data, setData] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<TripSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionId>("overview");
  const [activeGroupId, setActiveGroupId] = useState<string>("");
  const dataRef = useRef(data);
  dataRef.current = data;
  const activeGroupIdRef = useRef(activeGroupId);
  activeGroupIdRef.current = activeGroupId;
  const loadGenerationRef = useRef(0);
  const pendingCommandsRef = useRef<TripCommand[]>([]);
  const pendingGroupIdRef = useRef<string>("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runPersistRef = useRef<
    (commands: TripCommand[], persistGroupId: string) => Promise<boolean>
  >(async () => true);

  const buildStateFromGraph = useCallback(
    (
      graph: TripEntityGraph,
      context: {
        viewGroupId: string;
        warnings?: EngineWarning[];
        inviteCode?: string;
        rosterSummary?: RosterSummary;
        costLedger?: CostLedgerProjection | null;
        prev?: EngineState | null;
      },
    ): EngineState => {
      const view = deriveEngineViewFromGraph(graph, {
        groupId: context.viewGroupId,
        costLedger: context.costLedger ?? context.prev?.costLedger ?? null,
      });
      return {
        graph: view.graph,
        calendarProjection: view.calendarProjection,
        calendarRenderModel: view.calendarRenderModel,
        readiness: view.readiness,
        warnings: context.warnings ?? context.prev?.warnings ?? [],
        conflicts: view.conflicts,
        inviteCode: context.inviteCode ?? context.prev?.inviteCode ?? "",
        rosterSummary: context.rosterSummary ?? context.prev?.rosterSummary ?? EMPTY_ROSTER,
        costLedger:
          context.costLedger !== undefined
            ? context.costLedger
            : (context.prev?.costLedger ?? null),
      };
    },
    [],
  );

  const persistLocalSnapshot = useCallback(
    (
      graph: TripEntityGraph,
      opts?: {
        pendingCommands?: TripCommand[];
        pendingGroupId?: string;
        activeGroupId?: string;
        inviteCode?: string;
        rosterSummary?: RosterSummary;
        costLedger?: CostLedgerProjection | null;
      },
    ) => {
      mergeTripLocalDraft(tripId, {
        graph,
        pendingCommands: opts?.pendingCommands ?? [...pendingCommandsRef.current],
        pendingGroupId: opts?.pendingGroupId ?? pendingGroupIdRef.current,
        activeGroupId:
          opts?.activeGroupId ?? activeGroupIdRef.current ?? graph.mainGroupId,
        inviteCode: opts?.inviteCode,
        rosterSummary: opts?.rosterSummary,
        costLedger: opts?.costLedger,
      });
    },
    [tripId],
  );

  const applyDraft = useCallback(
    (draft: TripLocalDraft, viewGroupId?: string) => {
      const gid = viewGroupId ?? draft.activeGroupId ?? draft.graph.mainGroupId;
      setActiveGroupId(gid);
      setData(
        buildStateFromGraph(draft.graph, {
          viewGroupId: gid,
          inviteCode: draft.inviteCode,
          rosterSummary: draft.rosterSummary ?? EMPTY_ROSTER,
          costLedger: draft.costLedger,
        }),
      );
    },
    [buildStateFromGraph],
  );

  const applyResponse = useCallback(
    (
      body: SetupEngineResponse & { inviteCode?: string },
      context?: { viewGroupId?: string },
    ) => {
      const viewGroupId =
        context?.viewGroupId ?? activeGroupIdRef.current ?? body.graph.mainGroupId;
      const next = buildStateFromGraph(body.graph, {
        viewGroupId,
        warnings: body.warnings,
        inviteCode: body.inviteCode,
        rosterSummary: body.rosterSummary,
        costLedger: body.costLedger,
        prev: dataRef.current,
      });
      setActiveGroupId(viewGroupId);
      setData(next);
      persistLocalSnapshot(body.graph, {
        pendingCommands: [],
        pendingGroupId: "",
        activeGroupId: viewGroupId,
        inviteCode: next.inviteCode,
        rosterSummary: next.rosterSummary,
        costLedger: next.costLedger,
      });
    },
    [buildStateFromGraph, persistLocalSnapshot],
  );

  const fetchServerMetadata = useCallback(
    async (
      generation: number,
      groupId?: string,
      options?: { keepLocalGraph?: boolean },
    ) => {
      try {
        const gid = groupId ?? activeGroupIdRef.current;
        const qs = new URLSearchParams({ engine: "1" });
        if (gid) qs.set("groupId", gid);
        const res = await fetch(`/api/trips/${tripId}/setup?${qs}`);
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        } & SetupEngineResponse;
        if (generation !== loadGenerationRef.current || !res.ok) return;

        if (options?.keepLocalGraph && dataRef.current) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  inviteCode: body.inviteCode ?? prev.inviteCode,
                  rosterSummary: body.rosterSummary ?? prev.rosterSummary,
                  costLedger:
                    body.costLedger !== undefined ? body.costLedger : prev.costLedger,
                }
              : prev,
          );
          persistLocalSnapshot(dataRef.current.graph, {
            inviteCode: body.inviteCode ?? dataRef.current.inviteCode,
            rosterSummary: body.rosterSummary ?? dataRef.current.rosterSummary,
            costLedger:
              body.costLedger !== undefined ? body.costLedger : dataRef.current.costLedger,
          });
          return;
        }

        applyResponse(body, { viewGroupId: gid ?? body.graph.mainGroupId });
      } catch {
        // Background refresh only — local draft remains authoritative.
      }
    },
    [tripId, applyResponse, persistLocalSnapshot],
  );

  const load = useCallback(
    async (
      groupId?: string,
      options?: { silent?: boolean; forceServer?: boolean },
    ) => {
      const generation = ++loadGenerationRef.current;
      const silent = options?.silent ?? false;
      const forceServer = options?.forceServer ?? false;

      if (!forceServer) {
        const draft = readTripLocalDraft(tripId);
        if (draft?.graph) {
          pendingCommandsRef.current = [...draft.pendingCommands];
          pendingGroupIdRef.current = draft.pendingGroupId;
          applyDraft(draft, groupId);
          setError(null);
          setLoading(false);
          setRefreshing(false);
          if (draft.pendingCommands.length) scheduleFlushRef.current();
          void fetchServerMetadata(generation, groupId, {
            keepLocalGraph: draft.pendingCommands.length > 0,
          });
          return;
        }
      }

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        if (forceServer && pendingCommandsRef.current.length) {
          flushPendingRef.current();
          await waitForTripPersist(tripId);
        }
        if (generation !== loadGenerationRef.current) return;

        const gid = groupId ?? activeGroupIdRef.current;
        const qs = new URLSearchParams({ engine: "1" });
        if (gid) qs.set("groupId", gid);
        const res = await fetch(`/api/trips/${tripId}/setup?${qs}`);
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        } & SetupEngineResponse;
        if (generation !== loadGenerationRef.current) return;
        if (!res.ok) throw new Error(body.error || "Failed to load setup");
        applyResponse(body, {
          viewGroupId: gid ?? body.graph.mainGroupId,
        });
        setSaveStatus("idle");
      } catch (e) {
        if (generation !== loadGenerationRef.current) return;
        const draft = readTripLocalDraft(tripId);
        if (draft?.graph) {
          applyDraft(draft, groupId);
          setSaveStatus(draft.pendingCommands.length ? "sync_error" : "idle");
        } else {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      } finally {
        if (generation !== loadGenerationRef.current) return;
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [tripId, applyDraft, applyResponse, fetchServerMetadata],
  );

  const scheduleRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    if (!pendingCommandsRef.current.length) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      flushPendingRef.current();
    }, PERSIST_RETRY_MS);
  }, []);

  const runPersist = useCallback(
    async (commands: TripCommand[], persistGroupId: string) => {
      return enqueueTripPersist(tripId, async () => {
        try {
          const res = await fetch(`/api/trips/${tripId}/setup/commands`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ commands, groupId: persistGroupId }),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            syncOnly?: boolean;
            activitySync?: boolean;
            warnings?: EngineWarning[];
            conflicts?: EngineConflict[];
            costLedger?: CostLedgerProjection | null;
          } & Partial<SetupEngineResponse>;
          if (!res.ok) throw new Error(body.error || "Command failed");

          if (body.syncOnly) {
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    warnings: body.warnings ?? prev.warnings,
                    conflicts: body.conflicts ?? prev.conflicts,
                  }
                : prev,
            );
            if (dataRef.current) {
              persistLocalSnapshot(dataRef.current.graph, {
                pendingCommands: [],
                pendingGroupId: "",
              });
            }
          } else if (body.activitySync && dataRef.current) {
            setData((prev) => {
              if (!prev) return prev;
              const costLedger =
                body.costLedger !== undefined ? body.costLedger : prev.costLedger;
              const readiness =
                body.costLedger !== undefined
                  ? computeReadiness(prev.graph, prev.calendarProjection, costLedger)
                  : prev.readiness;
              return {
                ...prev,
                costLedger,
                readiness,
                warnings: body.warnings ?? prev.warnings,
                conflicts: body.conflicts ?? prev.conflicts,
              };
            });
            persistLocalSnapshot(dataRef.current.graph, {
              pendingCommands: [],
              pendingGroupId: "",
              costLedger:
                body.costLedger !== undefined ? body.costLedger : dataRef.current.costLedger,
            });
          } else if (body.graph) {
            applyResponse(body as SetupEngineResponse, {
              viewGroupId: activeGroupIdRef.current || persistGroupId,
            });
          } else {
            await fetchServerMetadata(loadGenerationRef.current, activeGroupIdRef.current, {
              keepLocalGraph: false,
            });
          }
          setSaveStatus("idle");
          if (retryTimerRef.current) {
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = null;
          }
          return true;
        } catch {
          setSaveStatus("sync_error");
          scheduleRetry();
          return false;
        }
      });
    },
    [tripId, applyResponse, fetchServerMetadata, persistLocalSnapshot, scheduleRetry],
  );

  useEffect(() => {
    runPersistRef.current = runPersist;
  }, [runPersist]);

  const flushPending = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const commands = pendingCommandsRef.current;
    pendingCommandsRef.current = [];
    if (!commands.length) return;
    const persistGroupId =
      pendingGroupIdRef.current ||
      activeGroupIdRef.current ||
      dataRef.current?.graph.mainGroupId ||
      "";
    void runPersistRef.current(commands, persistGroupId).then((ok) => {
      if (!ok) {
        pendingCommandsRef.current.push(...commands);
        if (dataRef.current) {
          persistLocalSnapshot(dataRef.current.graph, {
            pendingCommands: pendingCommandsRef.current,
            pendingGroupId: persistGroupId,
          });
        }
      }
    });
  }, [persistLocalSnapshot]);

  const flushPendingRef = useRef(flushPending);
  flushPendingRef.current = flushPending;

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flushPending();
    }, PERSIST_DEBOUNCE_MS);
  }, [flushPending]);

  const scheduleFlushRef = useRef(scheduleFlush);
  scheduleFlushRef.current = scheduleFlush;

  useEffect(() => {
    pendingCommandsRef.current = [];
    pendingGroupIdRef.current = "";
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, [tripId]);

  useEffect(() => {
    return () => {
      flushPending();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [flushPending]);

  useEffect(() => {
    function onBeforeUnload() {
      if (dataRef.current) {
        persistLocalSnapshot(dataRef.current.graph);
      }
      if (pendingCommandsRef.current.length) {
        flushPending();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushPending, persistLocalSnapshot]);

  const dispatch = useCallback(
    (commands: TripCommand[]): Promise<boolean> => {
      if (!dataRef.current) return Promise.resolve(false);

      const viewGroupId =
        activeGroupIdRef.current || dataRef.current.graph.mainGroupId;
      const persistGroupId = groupIdFromCommands(commands) ?? viewGroupId;
      const optimistic = applyCommands(dataRef.current.graph, commands);
      const nextState = buildStateFromGraph(optimistic.graph, {
        viewGroupId,
        warnings: optimistic.warnings,
        prev: dataRef.current,
      });

      pendingCommandsRef.current.push(...commands);
      pendingGroupIdRef.current = persistGroupId;

      persistLocalSnapshot(optimistic.graph, {
        pendingCommands: pendingCommandsRef.current,
        pendingGroupId: persistGroupId,
        activeGroupId: viewGroupId,
        inviteCode: nextState.inviteCode,
        rosterSummary: nextState.rosterSummary,
        costLedger: nextState.costLedger,
      });

      setData(nextState);
      setError(null);
      scheduleFlush();

      return Promise.resolve(true);
    },
    [buildStateFromGraph, persistLocalSnapshot, scheduleFlush],
  );

  const switchGroup = useCallback(
    (groupId: string) => {
      setActiveGroupId(groupId);
      setData((prev) => {
        if (!prev) return prev;
        const next = buildStateFromGraph(prev.graph, {
          viewGroupId: groupId,
          prev,
        });
        persistLocalSnapshot(prev.graph, { activeGroupId: groupId });
        return next;
      });
    },
    [buildStateFromGraph, persistLocalSnapshot],
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
          setData((prev) => {
            if (!prev) return prev;
            persistLocalSnapshot(prev.graph, { costLedger: body.costLedger! });
            return { ...prev, costLedger: body.costLedger! };
          });
        } else {
          await load(activeGroupId || data?.graph.mainGroupId, {
            silent: true,
            forceServer: true,
          });
        }
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Costs update failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tripId, activeGroupId, data?.graph.mainGroupId, load, persistLocalSnapshot],
  );

  return {
    data,
    loading,
    refreshing,
    saving,
    saveStatus,
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
