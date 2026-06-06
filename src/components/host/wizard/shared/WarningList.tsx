"use client";

import type { WizardWarning } from "@/lib/host/wizard/review-warnings";

export function WarningList({
  warnings,
  onGoToStep,
}: {
  warnings: WizardWarning[];
  onGoToStep?: (step: number) => void;
}) {
  if (!warnings.length) {
    return (
      <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        No warnings — looking good!
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {warnings.map((w) => (
        <li
          key={w.id}
          className={[
            "flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm",
            w.severity === "error"
              ? "bg-red-50 text-red-800"
              : w.severity === "warning"
                ? "bg-amber-50 text-amber-900"
                : "bg-zinc-50 text-zinc-700",
          ].join(" ")}
        >
          <span>{w.message}</span>
          {w.step && onGoToStep ? (
            <button
              type="button"
              onClick={() => onGoToStep(w.step!)}
              className="shrink-0 text-xs font-medium underline"
            >
              Fix
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
