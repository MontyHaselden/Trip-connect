import { buildTripAdminProjection } from "@/lib/trip-admin/build-admin-projection";

import { graphToSetupState, setupStateToGraph } from "./adapters";
import { buildCalendarRenderModel } from "./calendar-render-model";
import { detectGraphConflicts } from "./conflicts";
import { computeReadiness } from "./compute-readiness";
import type { CostLedgerProjection } from "./cost-ledger/types";
import type {
  CalendarProjection,
  CalendarRenderModel,
  RosterSummary,
  SetupEngineResponse,
  TripEntityGraph,
} from "./types";

function serializeRenderModel(model: CalendarRenderModel) {
  return {
    ...model,
    overlayMetaByDate: Object.fromEntries(model.overlayMetaByDate),
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
  const groupId = options?.groupId ?? graph.mainGroupId;
  const calendarRenderModel = buildCalendarRenderModel(graph, { groupId });
  const calendarProjection: CalendarProjection = {
    groupId,
    gridStart: calendarRenderModel.gridStart,
    gridEnd: calendarRenderModel.gridEnd,
    days: calendarRenderModel.projectedDays,
    accommodationByDate: calendarRenderModel.accommodationByDate,
    boundaries: calendarRenderModel.boundaries,
  };
  const readiness = computeReadiness(graph, calendarProjection, options?.costLedger);
  const conflicts = detectGraphConflicts(graph, calendarProjection, groupId);

  return {
    graph,
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

  const rosterSummary = options?.rosterSummary;
  const adminProjection =
    rosterSummary ?
      buildTripAdminProjection(view.graph, rosterSummary)
    : undefined;

  return {
    graph: view.graph,
    calendarProjection: view.calendarProjection,
    calendarRenderModel: view.calendarRenderModel,
    adminProjection,
    readiness: view.readiness,
    warnings: [],
    conflicts: view.conflicts,
    inviteCode: options?.inviteCode,
    rosterSummary,
    costLedger: options?.costLedger ?? undefined,
  };
}

/** Serialize projection Maps for JSON responses. */
export function serializeSetupResponse(response: SetupEngineResponse) {
  const serialized: Record<string, unknown> = { ...response };
  if (response.calendarProjection) {
    serialized.calendarProjection = {
      ...response.calendarProjection,
      accommodationByDate: Object.fromEntries(response.calendarProjection.accommodationByDate),
    };
  }
  if (response.calendarRenderModel) {
    serialized.calendarRenderModel = serializeRenderModel(response.calendarRenderModel);
  }
  return serialized;
}

function toMap<T>(v: Map<string, T> | Record<string, T> | undefined): Map<string, T> {
  if (v instanceof Map) return v;
  return new Map(Object.entries(v ?? {}) as [string, T][]);
}

export function deserializeRenderModel(raw: CalendarRenderModel): CalendarRenderModel {
  return {
    ...raw,
    overlayMetaByDate: toMap(raw.overlayMetaByDate as Map<string, CalendarRenderModel["overlayMetaByDate"] extends Map<string, infer V> ? V : never> | Record<string, CalendarRenderModel["overlayMetaByDate"] extends Map<string, infer V> ? V : never>),
    accommodationByDate: toMap(raw.accommodationByDate),
    activitiesByDate: toMap(raw.activitiesByDate),
    locationColorByKey: toMap(raw.locationColorByKey),
  };
}

export function deserializeCalendarProjection(
  raw: CalendarProjection,
): CalendarProjection {
  return {
    ...raw,
    accommodationByDate: toMap(raw.accommodationByDate),
  };
}

/** Restore Maps on engine payloads returned from the setup API. */
export function hydrateSetupEngineResponse(
  body: SetupEngineResponse,
): SetupEngineResponse {
  return {
    ...body,
    calendarProjection: body.calendarProjection
      ? deserializeCalendarProjection(body.calendarProjection)
      : undefined,
    calendarRenderModel: body.calendarRenderModel
      ? deserializeRenderModel(body.calendarRenderModel)
      : undefined,
  };
}
