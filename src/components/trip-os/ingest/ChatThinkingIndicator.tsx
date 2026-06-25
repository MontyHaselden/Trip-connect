"use client";

import { useChatThinkingStatus, type ChatThinkingMode } from "./useChatThinkingStatus";

export function ChatThinkingIndicator(props: {
  mode: ChatThinkingMode;
  onCancel?: () => void;
}) {
  const status = useChatThinkingStatus(true, props.mode);

  return (
    <div className="mr-4 rounded-2xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-zinc-800">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-violet-950">{status.label}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-violet-800/90">
            <span>
              Step {status.stepIndex + 1} of {status.stepCount}
            </span>
            <span aria-live="polite">{status.elapsedSec}s</span>
            {status.slow ? (
              <span className="text-amber-800">
                Taking longer than usual — you can cancel and try a shorter request.
              </span>
            ) : null}
          </div>
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: status.stepCount }, (_, index) => (
              <span
                key={index}
                className={[
                  "h-1 flex-1 rounded-full transition-colors",
                  index <= status.stepIndex ? "bg-violet-500" : "bg-violet-200",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </div>
      {props.onCancel ? (
        <button
          type="button"
          onClick={props.onCancel}
          className="mt-3 text-xs font-medium text-violet-800 hover:text-violet-950 hover:underline"
        >
          Cancel
        </button>
      ) : null}
    </div>
  );
}
