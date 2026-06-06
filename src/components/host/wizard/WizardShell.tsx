"use client";

import { WIZARD_STEPS } from "@/lib/host/wizard/types";

export function WizardShell({
  currentStep,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  backDisabled,
  nextDisabled,
  saving,
}: {
  currentStep: number;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  saving?: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <nav aria-label="Wizard progress" className="mb-8">
        <ol className="flex flex-wrap gap-1">
          {WIZARD_STEPS.map((s) => (
            <li
              key={s.step}
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium",
                s.step === currentStep
                  ? "bg-zinc-900 text-white"
                  : s.step < currentStep
                    ? "bg-zinc-200 text-zinc-700"
                    : "bg-zinc-100 text-zinc-400",
              ].join(" ")}
            >
              {s.label}
            </li>
          ))}
        </ol>
        {saving ? (
          <p className="mt-2 text-xs text-zinc-500">Saving…</p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Changes save automatically</p>
        )}
      </nav>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>

      <div className="mt-6 flex gap-3">
        {onBack ? (
          <button
            type="button"
            disabled={backDisabled}
            onClick={onBack}
            className="h-11 flex-1 rounded-xl border border-zinc-300 text-sm font-medium disabled:opacity-40"
          >
            Back
          </button>
        ) : null}
        {onNext ? (
          <button
            type="button"
            disabled={nextDisabled || saving}
            onClick={onNext}
            className="h-11 flex-1 rounded-xl bg-zinc-900 text-sm font-medium text-white disabled:opacity-40"
          >
            {nextLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
