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
const memory = new Map<string, TripLocalDraft>();

function storageKey(tripId: string): string {
  return `${STORAGE_PREFIX}${tripId}`;
}

export function readTripLocalDraft(tripId: string): TripLocalDraft | null {
  const cached = memory.get(tripId);
  if (cached) return cached;

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TripLocalDraft;
    if (parsed.v !== 1 || parsed.tripId !== tripId || !parsed.graph) return null;
    memory.set(tripId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeTripLocalDraft(draft: TripLocalDraft): void {
  memory.set(draft.tripId, draft);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(draft.tripId), JSON.stringify(draft));
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
