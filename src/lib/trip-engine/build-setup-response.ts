import { reconcileTripShellState } from "@/lib/host/setup/reconcile-trip-shell";
import { graphToSetupState, setupStateToGraph } from "./adapters";
import { buildCalendarRenderModel } from "./calendar-render-model";
import { detectGraphConflicts } from "./conflicts";
import { computeReadiness } from "./compute-readiness";
import { projectCalendar } from "./project-calendar";
import type { CalendarRenderModel, SetupEngineResponse, TripEntityGraph } from "./types";
import type { CostLedgerProjection } from "./cost-ledger/types";
import type { RosterSummary } from "./types";

function serializeRenderModel(model: CalendarRenderModel) {
  return {
    ...model,
    overlayMetaByDate: Object.fromEntries(model.overlayMetaByDate),
    travelLayoutsByDate: Object.fromEntries(model.travelLayoutsByDate),
    transitByDate: Object.fromEntries(model.transitByDate),
    accommodationByDate: Object.fromEntries(model.accommodationByDate),
    activitiesByDate: Object.fromEntries(model.activitiesByDate),
    locationColorByKey: Object.fromEntries(model.locationColorByKey),
  };
}

/** Rebuild calendar projection/render model after an in-memory graph change (optimistic UI). */
export function deriveEngineViewFromGraph(
  graph: TripEntityGraph,
  options?: {
    groupId?: string;
    costLedger?: CostLedgerProjection | null;
  },
) {
  const reconciled = setupStateToGraph(
    graph.tripId,
    reconcileTripShellState(graphToSetupState(graph)),
  );
  const groupId = options?.groupId ?? reconciled.mainGroupId;
  const calendarProjection = projectCalendar(reconciled, { groupId });
  const calendarRenderModel = buildCalendarRenderModel(reconciled, { groupId });
  const readiness = computeReadiness(reconciled, calendarProjection, options?.costLedger);
  const conflicts = detectGraphConflicts(reconciled, calendarProjection, groupId);

  return {
    graph: reconciled,
    calendarProjection,
    calendarRenderModel,
    readiness,
    conflicts,
  };
}

export function buildSetupEngineResponse(
  graph: TripEntityGraph,
  options?: {
    groupId?: string;
    inviteCode?: string;
    rosterSummary?: RosterSummary;
    costLedger?: CostLedgerProjection | null;
  },
): SetupEngineResponse {
  const view = deriveEngineViewFromGraph(graph, {
    groupId: options?.groupId,
    costLedger: options?.costLedger,
  });

  return {
    graph: view.graph,
    calendarProjection: view.calendarProjection,
    calendarRenderModel: view.calendarRenderModel,
    readiness: view.readiness,
    warnings: [],
    conflicts: view.conflicts,
    inviteCode: options?.inviteCode,
    rosterSummary: options?.rosterSummary,
    costLedger: options?.costLedger ?? undefined,
  };
}

/** Serialize projection Maps for JSON responses. */
export function serializeSetupResponse(response: SetupEngineResponse) {
  return {
    ...response,
    calendarProjection: {
      ...response.calendarProjection,
      accommodationByDate: Object.fromEntries(response.calendarProjection.accommodationByDate),
    },
    calendarRenderModel: serializeRenderModel(response.calendarRenderModel),
  };
}

function toMap<T>(v: Map<string, T> | Record<string, T> | undefined): Map<string, T> {
  if (v instanceof Map) return v;
  return new Map(Object.entries(v ?? {}) as [string, T][]);
}

export function deserializeRenderModel(raw: CalendarRenderModel): CalendarRenderModel {
  return {
    ...raw,
    overlayMetaByDate: toMap(raw.overlayMetaByDate as Map<string, CalendarRenderModel["overlayMetaByDate"] extends Map<string, infer V> ? V : never> | Record<string, CalendarRenderModel["overlayMetaByDate"] extends Map<string, infer V> ? V : never>),
    travelLayoutsByDate: toMap(raw.travelLayoutsByDate),
    transitByDate: toMap(raw.transitByDate),
    accommodationByDate: toMap(raw.accommodationByDate),
    activitiesByDate: toMap(raw.activitiesByDate),
    locationColorByKey: toMap(raw.locationColorByKey),
  };
}
