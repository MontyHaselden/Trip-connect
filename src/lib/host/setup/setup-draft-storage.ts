import { mergeDraftOverServer } from "./setup-group-state";
import type { TripSetupState } from "./types";

export { mergeDraftOverServer, removeGroupFromSetupState } from "./setup-group-state";

const KEY_PREFIX = "tc-setup-draft:";

export type SetupDraftBackup = {
  tripId: string;
  state: TripSetupState;
  updatedAt: number;
};

function storageKey(tripId: string): string {
  return `${KEY_PREFIX}${tripId}`;
}

export function saveSetupDraft(tripId: string, state: TripSetupState): void {
  try {
    const backup: SetupDraftBackup = {
      tripId,
      state,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(storageKey(tripId), JSON.stringify(backup));
  } catch {
    // Quota or private mode — ignore
  }
}

export function loadSetupDraft(tripId: string): SetupDraftBackup | null {
  try {
    const raw = sessionStorage.getItem(storageKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SetupDraftBackup;
    if (parsed.tripId !== tripId || !parsed.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSetupDraft(tripId: string): void {
  try {
    sessionStorage.removeItem(storageKey(tripId));
  } catch {
    // ignore
  }
}

function paintedDayCount(state: TripSetupState): number {
  const days = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  return days.filter((d) => d.primaryCity.trim() && d.dayType !== "buffer").length;
}

function setupRichness(state: TripSetupState): number {
  const transport =
    state.outboundLegs.length + state.returnLegs.length + state.intercityLegs.length;
  const stays = state.accommodationStays.filter((s) => s.name?.trim()).length;
  const activities = state.activities.length;
  return paintedDayCount(state) * 10 + transport * 5 + stays * 3 + activities;
}

/** Prefer the local draft when it clearly has more work than what the server returned. */
export function shouldRestoreSetupDraft(
  draft: SetupDraftBackup,
  serverState: TripSetupState,
): boolean {
  const draftRichness = setupRichness(draft.state);
  const serverRichness = setupRichness(serverState);
  if (draftRichness > serverRichness) return true;
  if (draftRichness === serverRichness && draftRichness > 0) return true;
  return false;
}

/** Apply a session draft while keeping group membership aligned with the server. */
export function restoreSetupDraft(
  draft: SetupDraftBackup,
  serverState: TripSetupState,
): TripSetupState {
  return mergeDraftOverServer(draft.state, serverState);
}
