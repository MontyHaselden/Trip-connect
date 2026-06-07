"use client";

import type { ReactNode } from "react";

/** Sidebar on the left, calendar fills all remaining width on the right — no nested scroll. */
export function WizardCalendarLayout({
  sidebar,
  sidebarFooter,
  calendar,
}: {
  sidebar: ReactNode;
  /** Footer under the sidebar (e.g. Back / Continue). */
  sidebarFooter?: ReactNode;
  calendar: ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] xl:grid-cols-[360px_1fr] lg:items-start">
      <aside className="space-y-4">
        {sidebar}
        {sidebarFooter}
      </aside>
      <div className="min-w-0 w-full">{calendar}</div>
    </div>
  );
}

export function WizardSidebarNav({
  onBack,
  onPreviousLeg,
  onContinue,
  continueLabel = "Continue",
  continueLoadingLabel,
  backLabel = "Back",
  previousLegLabel = "Previous leg",
  continueDisabled,
  backDisabled,
  previousLegDisabled,
  saving,
  hint,
}: {
  onBack?: () => void;
  /** Step-internal navigation (e.g. prior intercity leg). */
  onPreviousLeg?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueLoadingLabel?: string;
  backLabel?: string;
  previousLegLabel?: string;
  continueDisabled?: boolean;
  backDisabled?: boolean;
  previousLegDisabled?: boolean;
  saving?: boolean;
  hint?: string;
}) {
  if (!onBack && !onPreviousLeg && !onContinue) return null;

  const splitContinueRow = Boolean(onContinue && onBack && !onPreviousLeg);

  return (
    <div className="space-y-2 border-t border-zinc-200/80 pt-4">
      {hint ? <p className="text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
      {onPreviousLeg || (onBack && !splitContinueRow) ? (
        <div className="flex gap-2">
          {onPreviousLeg ? (
            <button
              type="button"
              disabled={previousLegDisabled || saving}
              onClick={onPreviousLeg}
              className="h-11 flex-1 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-40"
            >
              {previousLegLabel}
            </button>
          ) : null}
          {onBack && !splitContinueRow ? (
            <button
              type="button"
              disabled={backDisabled || saving}
              onClick={onBack}
              className="h-11 flex-1 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-40"
            >
              {backLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      {onContinue || (onBack && splitContinueRow) ? (
        <div className={splitContinueRow ? "flex gap-2" : undefined}>
          {onBack && splitContinueRow ? (
            <button
              type="button"
              disabled={backDisabled || saving}
              onClick={onBack}
              className="h-11 flex-1 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-40"
            >
              {backLabel}
            </button>
          ) : null}
          {onContinue ? (
            <button
              type="button"
              disabled={continueDisabled || saving}
              onClick={onContinue}
              className={[
                "h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40",
                splitContinueRow ? "flex-1" : "w-full",
              ].join(" ")}
            >
              {saving ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  {continueLoadingLabel ?? "Saving…"}
                </span>
              ) : (
                continueLabel
              )}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
