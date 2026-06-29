import type { TripCommand } from "@/lib/trip-engine/commands";
import type { CostLedgerProjection } from "@/lib/trip-engine/cost-ledger/types";
import type { CalendarLens } from "@/lib/trip-engine/person-lens";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

export type TripLocalDraft = {
  v: 1;
  tripId: string;
  graph: TripEntityGraph;
  pendingCommands: TripCommand[];
  pendingGroupId: string;
  activeGroupId: string;
  calendarLens: CalendarLens;
  inviteCode: string;
  rosterSummary: RosterSummary | null;
  costLedger: CostLedgerProjection | null;
  updatedAt: number;
};

const STORAGE_PREFIX = "trip-os:draft:";
/** Drafts above this size freeze the tab on JSON.parse — keep in memory only. */
export const MAX_TRIP_DRAFT_BYTES = 300_000;

const memory = new Map<string, TripLocalDraft>();

function storageKey(tripId: string): string {
  return `${STORAGE_PREFIX}${tripId}`;
}

export function clearOversizedTripLocalDraft(tripId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(storageKey(tripId));
    if (!raw || raw.length <= MAX_TRIP_DRAFT_BYTES) return false;
    clearTripLocalDraft(tripId);
    return true;
  } catch {
    return false;
  }
}

export function readTripLocalDraft(tripId: string): TripLocalDraft | null {
  const cached = memory.get(tripId);
  if (cached) return cached;

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(tripId));
    if (!raw) return null;
    if (raw.length > MAX_TRIP_DRAFT_BYTES) {
      clearTripLocalDraft(tripId);
      return null;
    }
    const parsed = JSON.parse(raw) as TripLocalDraft;
    if (parsed.v !== 1 || parsed.tripId !== tripId || !parsed.graph) {
      clearTripLocalDraft(tripId);
      return null;
    }
    memory.set(tripId, parsed);
    return parsed;
  } catch {
    clearTripLocalDraft(tripId);
    return null;
  }
}

export function writeTripLocalDraft(draft: TripLocalDraft): void {
  memory.set(draft.tripId, draft);
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(draft);
    if (raw.length > MAX_TRIP_DRAFT_BYTES) {
      return;
    }
    window.sessionStorage.setItem(storageKey(draft.tripId), raw);
  } catch {
    // Quota or private mode — in-memory cache still holds the draft for this tab.
  }
}

export function clearTripLocalDraft(tripId: string): void {
  memory.delete(tripId);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(tripId));
  } catch {
    // ignore
  }
}

export function mergeTripLocalDraft(
  tripId: string,
  patch: Partial<
    Pick<
      TripLocalDraft,
      | "graph"
      | "pendingCommands"
      | "pendingGroupId"
      | "activeGroupId"
      | "calendarLens"
      | "inviteCode"
      | "rosterSummary"
      | "costLedger"
    >
  >,
): TripLocalDraft | null {
  const existing = readTripLocalDraft(tripId);
  const graph = patch.graph ?? existing?.graph;
  if (!graph) return null;

  const next: TripLocalDraft = {
    v: 1,
    tripId,
    graph,
    pendingCommands: patch.pendingCommands ?? existing?.pendingCommands ?? [],
    pendingGroupId: patch.pendingGroupId ?? existing?.pendingGroupId ?? "",
    activeGroupId: patch.activeGroupId ?? existing?.activeGroupId ?? graph.mainGroupId,
    calendarLens:
      patch.calendarLens ??
      existing?.calendarLens ??
      ({ kind: "whole_group" } as const),
    inviteCode: patch.inviteCode ?? existing?.inviteCode ?? "",
    rosterSummary:
      patch.rosterSummary !== undefined ? patch.rosterSummary : (existing?.rosterSummary ?? null),
    costLedger:
      patch.costLedger !== undefined ? patch.costLedger : (existing?.costLedger ?? null),
    updatedAt: Date.now(),
  };
  writeTripLocalDraft(next);
  return next;
}
