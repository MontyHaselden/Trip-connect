import type { TripWizardDraft } from "./types";

/** True when the host has already filled steps after Dates & Places. */
export function hasLaterWizardProgress(
  draft: Pick<
    TripWizardDraft,
    | "shellCommitted"
    | "intercityLegs"
    | "accommodationStays"
    | "activities"
    | "meetings"
  >,
): boolean {
  if (draft.shellCommitted) return true;
  if (draft.accommodationStays.length > 0) return true;
  if (draft.activities.length > 0) return true;
  if (draft.meetings.length > 0) return true;
  return draft.intercityLegs.some(
    (leg) => leg.intercityFromCity.trim() || leg.fromCity.trim(),
  );
}

export const LATER_PROGRESS_WARNING =
  "Saving and continuing may affect progress you have already completed in later steps. Continue?";

/** @deprecated Use LATER_PROGRESS_WARNING */
export const CONFIRM_AFFECTS_LATER_MESSAGE = LATER_PROGRESS_WARNING;

export function confirmLaterProgressRisk(): boolean {
  return window.confirm(LATER_PROGRESS_WARNING);
}

export function snapshotDraft(draft: TripWizardDraft): string {
  return JSON.stringify(draft);
}

export function draftChangedSince(snapshot: string, draft: TripWizardDraft): boolean {
  return snapshot !== snapshotDraft(draft);
}
