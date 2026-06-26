"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import type { SetupSectionId } from "@/lib/host/setup/types";
import {
  mergeTripLocalDraft,
  readTripLocalDraft,
  clearTripLocalDraft,
  type TripLocalDraft,
} from "@/lib/trip-os/local-draft";
import {
  enqueueTripPersist,
  tripPersistInFlight,
  waitForTripPersist,
} from "@/lib/trip-os/persist-queue";
import { parseJsonOffThread } from "@/lib/trip-os/parse-json-off-thread";
import {
  deriveEngineViewFromGraph,
  hydrateSetupEngineResponse,
} from "@/lib/trip-engine/build-setup-response";
import {
  fastStubEngineCalendarView,
  setupResponseIncludesCalendarView,
  stubEngineCalendarView,
} from "@/lib/trip-engine/stub-engine-view";
import { applyCommandBatch } from "@/lib/trip-engine/apply-command-batch";
import { computeReadiness } from "@/lib/trip-engine/compute-readiness";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { groupIdFromCommands } from "@/lib/trip-engine/persist-command";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import {
  localCostLedgerIsAhead,
  mergePreferLocalCostLedger,
  pruneRunawayLocalFinanceLines,
} from "@/lib/trip-engine/cost-ledger/merge-local-cost-ledger";
import { mergeFinancePatchResult } from "@/lib/trip-engine/cost-ledger/merge-finance-patch-result";
import { mergeActivitiesById } from "@/lib/trip-engine/merge-graph-activities";
import { repairTransportGraphSync } from "@/lib/trip-engine/repair-transport-graph";
import { mergeOptimisticSeedsIntoCostLedger } from "@/lib/trip-engine/cost-ledger/optimistic-seed-cost-ledger";
import { pruneCostLedgerLinkedOrphans } from "@/lib/trip-engine/cost-ledger/prune-cost-ledger-orphans";
import {
  isServerFinanceLineId,
  planFinanceLineDeletes,
  removeFromTripCommandsForLines,
} from "@/lib/trip-engine/cost-ledger/finance-line-delete-plan";
import {
  ledgerHasUnmaterializedLinkedLines,
  remapOptimisticFinanceLineIds,
  resolveFinanceLineIdForServer,
} from "@/lib/trip-engine/cost-ledger/finance-line-resolve";
import {
  applyOptimisticFinancePatch,
  isOptimisticFinanceLineId,
  resolveFundDeleteServerPayload,
  resolveOptimisticFinanceLineId,
} from "@/lib/trip-engine/cost-ledger/optimistic-finance-patch";
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

export type CostsPatchResult = { ok: true } | { ok: false; error: string };

export type TripLoadPhase =
  | "connecting"
  | "downloading"
  | "parsing"
  | "preparing"
  | "building-calendar"
  | "ready";

export type TripLoadStatus = {
  phase: TripLoadPhase;
  progress: number;
  message: string;
};

export type TripLoadDebug = {
  active: boolean;
  phase: TripLoadPhase;
  progress: number;
  message: string;
  elapsedMs: number;
  payloadBytes?: number;
  meta?: Record<string, unknown>;
  logs: Array<{ t: number; msg: string }>;
};

/** Debounce before background server sync — local draft is written immediately. */
const PERSIST_DEBOUNCE_MS = 400;
const PERSIST_RETRY_MS = 8000;
const SETUP_FETCH_TIMEOUT_MS = 30_000;

const READY_LOAD_STATUS: TripLoadStatus = {
  phase: "ready",
  progress: 100,
  message: "",
};

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/** Run after the browser paints — avoids blocking first shell paint on heavy calendar builds. */
function scheduleAfterPaint(run: () => void) {
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(run, 0);
      });
    });
    return;
  }
  setTimeout(run, 32);
}

const EMPTY_ROSTER: RosterSummary = { participants: [], groups: [], rooms: [] };

function scheduleIdleWork(run: () => void) {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 0);
  }
}

function withRepairedTransportGraph(graph: TripEntityGraph): TripEntityGraph {
  return repairTransportGraphSync(graph);
}

function commandsNeedCostLedgerSeed(commands: TripCommand[]): boolean {
  return commands.some((c) =>
    [
      "addActivity",
      "addStay",
      "addTransportLeg",
      "addClassifiedTransportLegs",
      "addTransportProduct",
      "removeTransportProduct",
      "removeActivity",
      "removeStay",
      "removeTransportLeg",
    ].includes(c.type),
  );
}

function mergeCostLedgerForGraph(
  local: CostLedgerProjection | null | undefined,
  server: CostLedgerProjection | null | undefined,
  graph: TripEntityGraph,
  options?: { forceKeepLocal?: boolean },
): CostLedgerProjection | null | undefined {
  const merged = mergePreferLocalCostLedger(local, server, { ...options, graph });
  return pruneCostLedgerLinkedOrphans(merged, graph);
}

export function useTripOsEngine(tripId: string) {
  const [data, setData] = useState<EngineState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState<TripLoadStatus>(READY_LOAD_STATUS);
  const [loadDebug, setLoadDebug] = useState<TripLoadDebug>({
    active: false,
    phase: "connecting",
    progress: 0,
    message: "",
    elapsedMs: 0,
    logs: [],
  });
  const loadDebugStartRef = useRef(0);

  const pushLoadLog = useCallback((msg: string, patch?: Partial<TripLoadDebug>) => {
    const elapsedMs = loadDebugStartRef.current
      ? Date.now() - loadDebugStartRef.current
      : 0;
    setLoadDebug((prev) => ({
      ...prev,
      active: true,
      elapsedMs,
      ...patch,
      logs: [...prev.logs.slice(-49), { t: elapsedMs, msg }],
    }));
  }, []);

  const resetLoadDebug = useCallback(() => {
    loadDebugStartRef.current = Date.now();
    setLoadDebug({
      active: true,
      phase: "connecting",
      progress: 5,
      message: "Connecting…",
      elapsedMs: 0,
      logs: [],
    });
  }, []);

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
  const financePatchInFlightRef = useRef(0);
  const optimisticLineMapRef = useRef(new Map<string, string>());
  const refreshCostLedgerRef = useRef<
    () => Promise<CostLedgerProjection | null>
  >(async () => null);

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

  const paintSetupShell = useCallback(
    (
      body: SetupEngineResponse & { inviteCode?: string },
      viewGroupId: string,
      options?: { skipTransportRepair?: boolean },
    ) => {
      const graph = options?.skipTransportRepair
        ? body.graph
        : withRepairedTransportGraph(body.graph);
      const mergedCostLedger = mergeCostLedgerForGraph(
        dataRef.current?.costLedger,
        body.costLedger,
        graph,
        {
          forceKeepLocal: financePatchInFlightRef.current > 0,
        },
      );
      const stub = stubEngineCalendarView(graph, viewGroupId);
      setActiveGroupId(viewGroupId);
      setData({
        graph,
        calendarProjection: stub.calendarProjection,
        calendarRenderModel: stub.calendarRenderModel,
        readiness: body.readiness ?? [],
        warnings: body.warnings ?? [],
        conflicts: body.conflicts ?? [],
        inviteCode: body.inviteCode ?? "",
        rosterSummary: body.rosterSummary ?? EMPTY_ROSTER,
        costLedger: mergedCostLedger ?? null,
      });
      scheduleIdleWork(() => {
        persistLocalSnapshot(graph, {
          pendingCommands: pendingCommandsRef.current,
          pendingGroupId: pendingGroupIdRef.current,
          activeGroupId: viewGroupId,
          inviteCode: body.inviteCode,
          rosterSummary: body.rosterSummary ?? EMPTY_ROSTER,
          costLedger: mergedCostLedger ?? null,
        });
      });
    },
    [persistLocalSnapshot],
  );

  const applyDraft = useCallback(
    (draft: TripLocalDraft, viewGroupId?: string) => {
      const graph = withRepairedTransportGraph(draft.graph);
      const gid = viewGroupId ?? draft.activeGroupId ?? graph.mainGroupId;
      paintSetupShell(
        {
          graph,
          inviteCode: draft.inviteCode,
          rosterSummary: draft.rosterSummary ?? EMPTY_ROSTER,
          warnings: [],
          conflicts: [],
          readiness: [],
        },
        gid,
      );
      scheduleIdleWork(() => {
        const costLedger = draft.costLedger
          ? pruneRunawayLocalFinanceLines(draft.costLedger, graph)
          : null;
        setData(
          buildStateFromGraph(graph, {
            viewGroupId: gid,
            inviteCode: draft.inviteCode,
            rosterSummary: draft.rosterSummary ?? EMPTY_ROSTER,
            costLedger,
          }),
        );
        if (costLedger !== draft.costLedger || graph !== draft.graph) {
          persistLocalSnapshot(graph, { costLedger });
        }
      });
    },
    [buildStateFromGraph, paintSetupShell, persistLocalSnapshot],
  );

  const applyResponse = useCallback(
    (
      body: SetupEngineResponse & { inviteCode?: string },
      context?: { viewGroupId?: string; rebuildView?: boolean; skipTransportRepair?: boolean },
    ) => {
      const hydrated = hydrateSetupEngineResponse(body);
      const viewGroupId =
        context?.viewGroupId ?? activeGroupIdRef.current ?? hydrated.graph.mainGroupId;
      const graph = context?.skipTransportRepair
        ? hydrated.graph
        : withRepairedTransportGraph(hydrated.graph);
      const mergedCostLedger = mergeCostLedgerForGraph(
        dataRef.current?.costLedger,
        hydrated.costLedger,
        graph,
        {
          forceKeepLocal: financePatchInFlightRef.current > 0,
        },
      );
      const hasServerCalendar =
        !context?.rebuildView && setupResponseIncludesCalendarView(hydrated);
      const view = hasServerCalendar
        ? {
            graph,
            calendarProjection: hydrated.calendarProjection!,
            calendarRenderModel: hydrated.calendarRenderModel!,
            readiness: computeReadiness(
              graph,
              hydrated.calendarProjection!,
              mergedCostLedger,
            ),
            conflicts: hydrated.conflicts ?? [],
          }
        : deriveEngineViewFromGraph(graph, {
            groupId: viewGroupId,
            costLedger: mergedCostLedger,
          });
      const next: EngineState = {
        graph: view.graph,
        calendarProjection: view.calendarProjection,
        calendarRenderModel: view.calendarRenderModel,
        readiness: view.readiness,
        warnings: hydrated.warnings ?? dataRef.current?.warnings ?? [],
        conflicts: view.conflicts,
        inviteCode: hydrated.inviteCode ?? dataRef.current?.inviteCode ?? "",
        rosterSummary: hydrated.rosterSummary ?? dataRef.current?.rosterSummary ?? EMPTY_ROSTER,
        costLedger:
          mergedCostLedger !== undefined
            ? mergedCostLedger
            : (dataRef.current?.costLedger ?? null),
      };
      setActiveGroupId(viewGroupId);
      setData(next);
      persistLocalSnapshot(graph, {
        pendingCommands: [],
        pendingGroupId: "",
        activeGroupId: viewGroupId,
        inviteCode: next.inviteCode,
        rosterSummary: next.rosterSummary,
        costLedger: next.costLedger,
      });
    },
    [persistLocalSnapshot],
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
          const mergedActivities = mergeActivitiesById(
            dataRef.current.graph.activities,
            body.graph.activities,
          );
          const mergedGraph = {
            ...dataRef.current.graph,
            activities: mergedActivities,
          };
          const mergedCostLedger = mergeCostLedgerForGraph(
            dataRef.current.costLedger,
            body.costLedger,
            mergedGraph,
            {
              forceKeepLocal:
                financePatchInFlightRef.current > 0 ||
                localCostLedgerIsAhead(
                  dataRef.current.costLedger,
                  body.costLedger,
                  dataRef.current.graph,
                ),
            },
          );
          let nextCostLedger = mergedCostLedger ?? dataRef.current.costLedger;
          if (
            mergedActivities.length > dataRef.current.graph.activities.length &&
            nextCostLedger
          ) {
            nextCostLedger = mergeOptimisticSeedsIntoCostLedger(
              nextCostLedger,
              mergedGraph,
              dataRef.current.rosterSummary ?? EMPTY_ROSTER,
            );
          }
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  graph: mergedGraph,
                  inviteCode: body.inviteCode ?? prev.inviteCode,
                  rosterSummary: body.rosterSummary ?? prev.rosterSummary,
                  costLedger: nextCostLedger ?? prev.costLedger,
                }
              : prev,
          );
          persistLocalSnapshot(mergedGraph, {
            inviteCode: body.inviteCode ?? dataRef.current.inviteCode,
            rosterSummary: body.rosterSummary ?? dataRef.current.rosterSummary,
            costLedger: nextCostLedger,
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
      options?: { silent?: boolean; forceServer?: boolean; skipLocalDraft?: boolean },
    ) => {
      const generation = ++loadGenerationRef.current;
      const forceServer = options?.forceServer ?? false;
      const skipLocalDraft = options?.skipLocalDraft ?? forceServer;

      resetLoadDebug();
      setRefreshing(true);
      setError(null);
      setLoadStatus({ phase: "connecting", progress: 10, message: "Connecting…" });
      pushLoadLog("load() started");
      await yieldToMain();
      try {
        if (forceServer && pendingCommandsRef.current.length) {
          pushLoadLog("flushing pending commands before force reload");
          flushPendingRef.current();
          await waitForTripPersist(tripId);
        }
        if (generation !== loadGenerationRef.current) return;

        const gid = groupId ?? activeGroupIdRef.current;
        const qs = new URLSearchParams({ engine: "1" });
        if (gid) qs.set("groupId", gid);
        setLoadStatus({ phase: "downloading", progress: 25, message: "Downloading trip…" });
        pushLoadLog(`fetch /api/trips/${tripId}/setup?${qs}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SETUP_FETCH_TIMEOUT_MS);
        const res = await fetch(`/api/trips/${tripId}/setup?${qs}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (generation !== loadGenerationRef.current) return;

        const buffer = await res.arrayBuffer();
        pushLoadLog(`response ${res.status}, ${buffer.byteLength} bytes`, {
          payloadBytes: buffer.byteLength,
          progress: 45,
          phase: "parsing",
          message: "Parsing trip data…",
        });
        setLoadStatus({ phase: "parsing", progress: 45, message: "Parsing trip data…" });
        await yieldToMain();

        let body: { error?: string; meta?: Record<string, unknown> } & SetupEngineResponse;
        try {
          body = await parseJsonOffThread<{ error?: string; meta?: Record<string, unknown> } & SetupEngineResponse>(buffer);
        } catch {
          throw new Error("Could not read trip data from the server.");
        }
        pushLoadLog("JSON parsed", {
          progress: 55,
          phase: "preparing",
          message: "Preparing workspace…",
          meta: body.meta,
        });
        if (generation !== loadGenerationRef.current) return;
        if (!res.ok) throw new Error(body.error || "Failed to load setup");

        let draft: TripLocalDraft | null = null;
        if (!skipLocalDraft) {
          pushLoadLog("reading local draft");
          draft = readTripLocalDraft(tripId);
        } else {
          setTimeout(() => clearTripLocalDraft(tripId), 0);
        }

        const viewGroupId = gid ?? draft?.activeGroupId ?? body.graph.mainGroupId;
        if (draft?.pendingCommands.length) {
          pendingCommandsRef.current = [...draft.pendingCommands];
          pendingGroupIdRef.current = draft.pendingGroupId;
        }

        const graph = body.graph;
        const stub = fastStubEngineCalendarView(graph, viewGroupId);
        setLoadStatus({ phase: "preparing", progress: 65, message: "Painting shell…" });
        pushLoadLog("painting shell (immediate)");
        setActiveGroupId(viewGroupId);
        startTransition(() => {
          setData({
            graph,
            calendarProjection: stub.calendarProjection,
            calendarRenderModel: stub.calendarRenderModel,
            readiness: body.readiness ?? [],
            warnings: body.warnings ?? [],
            conflicts: body.conflicts ?? [],
            inviteCode: body.inviteCode ?? "",
            rosterSummary: body.rosterSummary ?? EMPTY_ROSTER,
            costLedger: body.costLedger ?? null,
          });
        });
        setSaveStatus("idle");
        pushLoadLog("shell painted");

        scheduleAfterPaint(() => {
          void (async () => {
            if (generation !== loadGenerationRef.current) return;
            setLoadStatus({
              phase: "building-calendar",
              progress: 85,
              message: "Building calendar…",
            });
            pushLoadLog("applyResponse (calendar build)", {
              phase: "building-calendar",
              progress: 85,
              message: "Building calendar…",
            });
            await yieldToMain();
            if (generation !== loadGenerationRef.current) return;
            try {
              applyResponse(body, {
                viewGroupId,
                rebuildView: true,
                skipTransportRepair: true,
              });
              pushLoadLog("calendar ready", {
                progress: 100,
                phase: "ready",
                message: "Ready",
              });
            } catch (calendarErr) {
              const errMsg =
                calendarErr instanceof Error
                  ? `Calendar build failed: ${calendarErr.message}`
                  : "Calendar build failed.";
              pushLoadLog(errMsg);
              setError(errMsg);
            }
            setLoadStatus(READY_LOAD_STATUS);
            setLoadDebug((prev) => ({ ...prev, active: false }));
            void refreshCostLedgerRef.current();
            if (pendingCommandsRef.current.length) scheduleFlushRef.current();
          })();
        });
      } catch (e) {
        if (generation !== loadGenerationRef.current) return;
        pushLoadLog(
          e instanceof Error ? e.message : "Load failed",
          { phase: "connecting", progress: 0, message: "Failed" },
        );
        const fallbackDraft = readTripLocalDraft(tripId);
        if (fallbackDraft?.graph) {
          try {
            applyDraft(fallbackDraft, groupId);
            setSaveStatus(fallbackDraft.pendingCommands.length ? "sync_error" : "idle");
          } catch {
            clearTripLocalDraft(tripId);
            setError(e instanceof Error ? e.message : "Load failed");
          }
        } else {
          const message =
            e instanceof Error && e.name === "AbortError"
              ? "Server took too long (30s). Try again."
              : e instanceof Error
                ? e.message
                : "Load failed";
          setError(message);
        }
      } finally {
        if (generation !== loadGenerationRef.current) return;
        setRefreshing(false);
        setLoading(false);
      }
    },
    [tripId, applyDraft, applyResponse, paintSetupShell, pushLoadLog, resetLoadDebug],
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
            const graph = dataRef.current.graph;
            setData((prev) => {
              if (!prev) return prev;
              const costLedger =
                body.costLedger !== undefined
                  ? mergeCostLedgerForGraph(prev.costLedger, body.costLedger, prev.graph, {
                      forceKeepLocal: financePatchInFlightRef.current > 0,
                    })
                  : pruneCostLedgerLinkedOrphans(prev.costLedger, prev.graph);
              const readiness =
                body.costLedger !== undefined
                  ? computeReadiness(prev.graph, prev.calendarProjection, costLedger ?? null)
                  : prev.readiness;
              return {
                ...prev,
                costLedger: costLedger ?? prev.costLedger,
                readiness,
                warnings: body.warnings ?? prev.warnings,
                conflicts: body.conflicts ?? prev.conflicts,
              };
            });
            const mergedCostLedger =
              body.costLedger !== undefined
                ? mergeCostLedgerForGraph(
                    dataRef.current.costLedger,
                    body.costLedger,
                    graph,
                    {
                      forceKeepLocal: financePatchInFlightRef.current > 0,
                    },
                  )
                : pruneCostLedgerLinkedOrphans(dataRef.current.costLedger, graph);
            persistLocalSnapshot(dataRef.current.graph, {
              pendingCommands: [],
              pendingGroupId: "",
              costLedger: mergedCostLedger,
            });
          } else if (body.graph) {
            applyResponse(body as SetupEngineResponse, {
              viewGroupId: activeGroupIdRef.current || persistGroupId,
              rebuildView: false,
            });
          } else {
            await fetchServerMetadata(loadGenerationRef.current, activeGroupIdRef.current, {
              keepLocalGraph:
                financePatchInFlightRef.current > 0 ||
                localCostLedgerIsAhead(
                  dataRef.current?.costLedger,
                  undefined,
                  dataRef.current?.graph,
                ),
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
    return () => {
      loadGenerationRef.current += 1;
    };
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
      const optimistic = applyCommandBatch(dataRef.current.graph, commands);
      const rosterSummary = dataRef.current.rosterSummary ?? EMPTY_ROSTER;
      let nextCostLedger = dataRef.current.costLedger;
      if (commandsNeedCostLedgerSeed(commands)) {
        nextCostLedger = mergeOptimisticSeedsIntoCostLedger(
          nextCostLedger,
          optimistic.graph,
          rosterSummary,
        );
      }
      nextCostLedger = pruneCostLedgerLinkedOrphans(nextCostLedger, optimistic.graph);
      const nextState = buildStateFromGraph(optimistic.graph, {
        viewGroupId,
        warnings: optimistic.warnings,
        prev: dataRef.current,
        costLedger: nextCostLedger,
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
    async (groupId: string) => {
      setActiveGroupId(groupId);
      const prev = dataRef.current;
      if (!prev) return;

      let graph = prev.graph;
      const needsDayPlaces =
        groupId !== graph.mainGroupId &&
        !(graph.dayPlacesByGroupId[groupId]?.length ?? 0);
      if (needsDayPlaces) {
        try {
          const res = await fetch(
            `/api/trips/${tripId}/groups/${groupId}/day-places`,
          );
          const payload = (await res.json().catch(() => ({}))) as {
            dayPlaces?: TripEntityGraph["dayPlacesByGroupId"][string];
          };
          if (res.ok && payload.dayPlaces) {
            graph = {
              ...graph,
              dayPlacesByGroupId: {
                ...graph.dayPlacesByGroupId,
                [groupId]: payload.dayPlaces,
              },
            };
          }
        } catch {
          // Fall back to inherit-mode calendar without stored overlay rows.
        }
      }

      if (
        prev.calendarRenderModel.groupId === groupId &&
        prev.calendarProjection.groupId === groupId &&
        prev.calendarRenderModel.days.length > 0 &&
        graph === prev.graph
      ) {
        persistLocalSnapshot(graph, { activeGroupId: groupId });
        return;
      }

      const next = buildStateFromGraph(graph, {
        viewGroupId: groupId,
        prev: { ...prev, graph },
      });
      setData(next);
      persistLocalSnapshot(graph, { activeGroupId: groupId });
    },
    [tripId, buildStateFromGraph, persistLocalSnapshot],
  );

  const patchChainRef = useRef(Promise.resolve<CostsPatchResult>({ ok: true }));

  const refreshCostLedgerFromServer = useCallback(async (): Promise<CostLedgerProjection | null> => {
    try {
      const res = await fetch(`/api/trips/${tripId}/costs`);
      const body = (await res.json().catch(() => ({}))) as {
        costLedger?: CostLedgerProjection;
      };
      if (!res.ok || !body.costLedger) return null;
      setData((prev) => {
        if (!prev) return prev;
        const merged = mergeCostLedgerForGraph(prev.costLedger, body.costLedger, prev.graph, {
          forceKeepLocal: financePatchInFlightRef.current > 0,
        });
        const costLedger = merged ?? body.costLedger!;
        remapOptimisticFinanceLineIds(costLedger, optimisticLineMapRef.current);
        persistLocalSnapshot(prev.graph, { costLedger });
        return { ...prev, costLedger };
      });
      return body.costLedger;
    } catch {
      return null;
    }
  }, [tripId, persistLocalSnapshot]);

  refreshCostLedgerRef.current = refreshCostLedgerFromServer;

  const materializeLinkedFinanceLines = useCallback(async (): Promise<void> => {
    const ledger = dataRef.current?.costLedger;
    if (!ledger || !ledgerHasUnmaterializedLinkedLines(ledger)) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/costs`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "seedFromTrip" }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        costLedger?: CostLedgerProjection;
      };
      if (!res.ok || !body.costLedger) return;
      setData((prev) => {
        if (!prev) return prev;
        const merged = mergeCostLedgerForGraph(prev.costLedger, body.costLedger, prev.graph, {
          forceKeepLocal: financePatchInFlightRef.current > 0,
        });
        const costLedger = merged ?? body.costLedger!;
        remapOptimisticFinanceLineIds(costLedger, optimisticLineMapRef.current);
        persistLocalSnapshot(prev.graph, { costLedger });
        return { ...prev, costLedger };
      });
    } catch {
      // Background materialization — local optimistic rows remain editable.
    }
  }, [tripId, persistLocalSnapshot]);

  const resolveFinancePayload = useCallback(
    (payload: Record<string, unknown>): { payload: Record<string, unknown> } => {
      const action = payload.action;
      if (action === "updateLine" && typeof payload.lineId === "string") {
        const resolved = resolveOptimisticFinanceLineId(
          payload.lineId,
          optimisticLineMapRef.current,
        );
        if (resolved && resolved !== payload.lineId) {
          return { payload: { ...payload, lineId: resolved } };
        }
      }
      if (action === "reorderSectionLines" && Array.isArray(payload.orderedIds)) {
        const ledger = dataRef.current?.costLedger;
        const orderedIds = (payload.orderedIds as string[])
          .map((id) => {
            const mapped = resolveOptimisticFinanceLineId(id, optimisticLineMapRef.current);
            if (mapped) return mapped;
            if (ledger) {
              return resolveFinanceLineIdForServer(id, ledger, optimisticLineMapRef.current) ?? id;
            }
            return id;
          })
          .filter((id) => isServerFinanceLineId(id));
        return { payload: { ...payload, orderedIds } };
      }
      return { payload };
    },
    [],
  );

  const patchCosts = useCallback(
    async (payload: Record<string, unknown>): Promise<CostsPatchResult> => {
      const resolved = resolveFinancePayload(payload);
      const serverPayload = resolved.payload;

      let ledgerBeforeOptimistic: CostLedgerProjection | null = null;
      let appliedOptimisticImmediately = false;

      const snapBeforeQueue = dataRef.current;
      if (snapBeforeQueue?.costLedger) {
        const immediate = applyOptimisticFinancePatch(
          snapBeforeQueue.costLedger,
          snapBeforeQueue.rosterSummary,
          snapBeforeQueue.graph,
          serverPayload,
        );
        if (immediate) {
          ledgerBeforeOptimistic = snapBeforeQueue.costLedger;
          appliedOptimisticImmediately = true;
          setData((prev) => (prev ? { ...prev, costLedger: immediate } : prev));
          persistLocalSnapshot(snapBeforeQueue.graph, { costLedger: immediate });
        }
      }

      const run = async (): Promise<CostsPatchResult> => {
        financePatchInFlightRef.current += 1;
        const snapshot = dataRef.current;
        if (!snapshot?.costLedger) {
          financePatchInFlightRef.current -= 1;
          const error = "Finance data is not loaded yet.";
          setError(error);
          return { ok: false, error };
        }

        const beforeLineIds =
          appliedOptimisticImmediately && ledgerBeforeOptimistic
            ? new Set(ledgerBeforeOptimistic.lineItems.map((line) => line.id))
            : new Set(snapshot.costLedger.lineItems.map((line) => line.id));
        let pendingOptimisticLineId: string | null = null;

        let optimistic: CostLedgerProjection | null = null;
        if (!appliedOptimisticImmediately) {
          optimistic = applyOptimisticFinancePatch(
            snapshot.costLedger,
            snapshot.rosterSummary,
            snapshot.graph,
            serverPayload,
          );
          if (optimistic) {
            if (serverPayload.action === "addLine") {
              const added = optimistic.lineItems.find((line) => !beforeLineIds.has(line.id));
              if (added && isOptimisticFinanceLineId(added.id)) {
                pendingOptimisticLineId = added.id;
              }
            }
            setData((prev) => (prev ? { ...prev, costLedger: optimistic } : prev));
            persistLocalSnapshot(snapshot.graph, { costLedger: optimistic });
          }
        } else if (serverPayload.action === "addLine") {
          const added = snapshot.costLedger.lineItems.find((line) => !beforeLineIds.has(line.id));
          if (added && isOptimisticFinanceLineId(added.id)) {
            pendingOptimisticLineId = added.id;
          }
        }

        const fundsBeforeOptimistic =
          ledgerBeforeOptimistic?.funds ??
          snapBeforeQueue?.costLedger?.funds ??
          snapshot.costLedger.funds;
        const fundDelete = resolveFundDeleteServerPayload(serverPayload, fundsBeforeOptimistic);
        let payloadForServer = fundDelete.payload;

        const skipServerSync = fundDelete.skipServer;

        if (skipServerSync) {
          setError(null);
          financePatchInFlightRef.current -= 1;
          return { ok: true };
        }

        const deleteActions = new Set([
          "deleteLines",
          "deleteLine",
          "dismissAndDeleteLine",
          "removeLineFromTrip",
        ]);
        const ledgerForPlan = snapshot.costLedger;

        if (
          serverPayload.action === "updateLine" &&
          typeof serverPayload.lineId === "string"
        ) {
          let serverLineId = resolveFinanceLineIdForServer(
            serverPayload.lineId,
            ledgerForPlan,
            optimisticLineMapRef.current,
          );
          if (!serverLineId && isOptimisticFinanceLineId(serverPayload.lineId)) {
            try {
              const seedRes = await fetch(`/api/trips/${tripId}/costs`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "seedFromTrip" }),
              });
              const seedBody = (await seedRes.json().catch(() => ({}))) as {
                costLedger?: CostLedgerProjection;
              };
              if (seedRes.ok && seedBody.costLedger) {
                remapOptimisticFinanceLineIds(
                  seedBody.costLedger,
                  optimisticLineMapRef.current,
                );
                serverLineId = resolveFinanceLineIdForServer(
                  serverPayload.lineId,
                  seedBody.costLedger,
                  optimisticLineMapRef.current,
                );
                if (serverLineId) {
                  setData((prev) => {
                    if (!prev) return prev;
                    const merged = mergeCostLedgerForGraph(
                      prev.costLedger,
                      seedBody.costLedger!,
                      prev.graph,
                      { forceKeepLocal: true },
                    );
                    const costLedger = merged ?? seedBody.costLedger!;
                    persistLocalSnapshot(prev.graph, { costLedger });
                    return { ...prev, costLedger };
                  });
                }
              }
            } catch {
              // Local optimistic edit already applied — sync in background.
            }
          }
          if (serverLineId && serverLineId !== serverPayload.lineId) {
            payloadForServer = { ...serverPayload, lineId: serverLineId };
          } else if (
            !serverLineId &&
            isOptimisticFinanceLineId(serverPayload.lineId)
          ) {
            setError(null);
            financePatchInFlightRef.current -= 1;
            void materializeLinkedFinanceLines();
            return { ok: true };
          }
        }

        if (deleteActions.has(String(serverPayload.action))) {
          const actionName = String(serverPayload.action);
          const lineIds =
            actionName === "deleteLines"
              ? (serverPayload.lineIds as string[])
              : [serverPayload.lineId as string];
          const mode =
            actionName === "removeLineFromTrip" ||
            (actionName === "deleteLines" && serverPayload.mode === "removeFromTrip")
              ? "removeFromTrip"
              : "financeOnly";

          const plan = planFinanceLineDeletes(
            lineIds,
            mode,
            ledgerForPlan,
            optimisticLineMapRef.current,
          );

          if (plan.removeFromTripLines.length) {
            const commands = removeFromTripCommandsForLines(
              snapshot.graph,
              plan.removeFromTripLines,
            );
            if (commands.length) {
              const tripOk = await dispatch(commands);
              if (!tripOk) {
                financePatchInFlightRef.current -= 1;
                const error = "Could not remove linked trip items.";
                setError(error);
                return { ok: false, error };
              }
            }
          }

          if (plan.dismissKeys.length) {
            const dismissRes = await fetch(`/api/trips/${tripId}/costs`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                action: "dismissLinkedEntities",
                keys: plan.dismissKeys,
              }),
            });
            const dismissBody = (await dismissRes.json().catch(() => ({}))) as {
              error?: string;
            };
            if (!dismissRes.ok) {
              financePatchInFlightRef.current -= 1;
              const error = dismissBody.error || "Could not update finance.";
              setError(error);
              return { ok: false, error };
            }
          }

          if (!plan.serverLineIds.length) {
            if (plan.removeFromTripLines.length) {
              void flushPendingRef.current();
            }
            setError(null);
            financePatchInFlightRef.current -= 1;
            return { ok: true };
          }

          if (actionName === "deleteLines") {
            payloadForServer = { ...serverPayload, lineIds: plan.serverLineIds };
          } else {
            payloadForServer = { ...serverPayload, lineId: plan.serverLineIds[0] };
          }
        }

        try {
          const res = await fetch(`/api/trips/${tripId}/costs`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payloadForServer),
          });
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
            costLedger?: CostLedgerProjection;
          };
          if (!res.ok) throw new Error(body.error || "Costs update failed");
          if (body.costLedger) {
            if (pendingOptimisticLineId) {
              const created = body.costLedger.lineItems.filter((line) => !beforeLineIds.has(line.id));
              if (created.length >= 1) {
                const addPayload = serverPayload.line as {
                  description?: string;
                  allocationRulePayload?: { financeSection?: string };
                };
                const match =
                  created.find(
                    (line) =>
                      line.description === (addPayload.description ?? "New line") &&
                      line.allocationRulePayload?.financeSection ===
                        addPayload.allocationRulePayload?.financeSection,
                  ) ?? created[created.length - 1];
                if (match) {
                  optimisticLineMapRef.current.set(pendingOptimisticLineId, match.id);
                }
              }
            }
            setData((prev) => {
              if (!prev) return prev;
              const latestLedger = dataRef.current?.costLedger ?? prev.costLedger;
              const costLedger = latestLedger
                ? mergeFinancePatchResult(latestLedger, body.costLedger!)
                : body.costLedger!;
              persistLocalSnapshot(prev.graph, { costLedger });
              return { ...prev, costLedger };
            });
          }
          setError(null);
          return { ok: true };
        } catch (e) {
          const refreshed = await refreshCostLedgerFromServer();
          const keepOptimisticAdd =
            appliedOptimisticImmediately && serverPayload.action === "addLine";
          if (!refreshed && !keepOptimisticAdd && ledgerBeforeOptimistic) {
            setData((prev) =>
              prev ? { ...prev, costLedger: ledgerBeforeOptimistic! } : prev,
            );
            persistLocalSnapshot(snapshot.graph, { costLedger: ledgerBeforeOptimistic });
          } else if (!refreshed && !keepOptimisticAdd && !appliedOptimisticImmediately) {
            setData(snapshot);
            persistLocalSnapshot(snapshot.graph, { costLedger: snapshot.costLedger });
          }
          const error = e instanceof Error ? e.message : "Costs update failed";
          setError(error);
          return { ok: false, error };
        } finally {
          financePatchInFlightRef.current -= 1;
        }
      };

      // Instant UI for lightweight toggles — fund/payment deletes queue like other patches.
      if (payload.action === "setFinanceSectionParticipant") {
        return run();
      }

      const result = patchChainRef.current.then(run, run);
      patchChainRef.current = result.then(
        () => ({ ok: true }) as CostsPatchResult,
        () => ({ ok: true }) as CostsPatchResult,
      );
      return result;
    },
    [tripId, persistLocalSnapshot, refreshCostLedgerFromServer, resolveFinancePayload, dispatch, materializeLinkedFinanceLines],
  );

  const resolveFinanceLineId = useCallback((lineId: string): string => {
    const ledger = dataRef.current?.costLedger;
    if (ledger) {
      const resolved = resolveFinanceLineIdForServer(
        lineId,
        ledger,
        optimisticLineMapRef.current,
      );
      if (resolved) return resolved;
    }
    return resolveOptimisticFinanceLineId(lineId, optimisticLineMapRef.current) ?? lineId;
  }, []);

  useEffect(() => {
    const ledger = data?.costLedger;
    if (!ledger || !ledgerHasUnmaterializedLinkedLines(ledger)) return;
    void materializeLinkedFinanceLines();
  }, [data?.costLedger, materializeLinkedFinanceLines]);

  return {
    data,
    loading,
    loadStatus,
    loadDebug,
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
    resolveFinanceLineId,
  };
}
