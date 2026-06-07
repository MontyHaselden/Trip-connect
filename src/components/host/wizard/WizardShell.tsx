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
  savingMessage,
  wide = false,
  hideFooterNav = false,
}: {
  currentStep: number;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  saving?: boolean;
  savingMessage?: string | null;
  wide?: boolean;
  hideFooterNav?: boolean;
}) {
  return (
    <div
      className={
        wide ? "mx-auto w-full max-w-[1680px] px-5 py-6 lg:px-10" : "mx-auto max-w-3xl px-5 py-8"
      }
    >
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
          <p className="mt-2 text-xs text-zinc-500">{savingMessage ?? "Saving…"}</p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">Changes save automatically</p>
        )}
      </nav>

      <div
        className={[
          "rounded-2xl border border-zinc-200 bg-white shadow-sm",
          wide ? "p-4 sm:p-5 lg:p-6" : "p-6",
        ].join(" ")}
      >
        {children}
      </div>

      {hideFooterNav ? null : (
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
            {saving ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span
                  className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                  aria-hidden
                />
                {savingMessage ?? "Saving…"}
              </span>
            ) : (
              nextLabel
            )}
          </button>
        ) : null}
      </div>
      )}
    </div>
  );
}
