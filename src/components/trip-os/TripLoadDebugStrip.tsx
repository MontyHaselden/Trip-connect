"use client";

import { useState } from "react";

import type { TripLoadDebug } from "./useTripOsEngine";

function formatBytes(n?: number): string {
  if (n == null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function TripLoadDebugStrip(props: {
  debug: TripLoadDebug;
  onRetry?: () => void;
  onClearCache?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const { debug } = props;
  const show = debug.active || debug.logs.length > 0;

  if (!show) return null;

  return (
    <div className="pointer-events-auto shrink-0 border-b border-violet-200 bg-violet-50/95 px-3 py-2 text-xs text-violet-950">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-medium text-violet-800 underline-offset-2 hover:underline"
          >
            {open ? "Hide" : "Show"} load debug
          </button>
          <span className="tabular-nums font-semibold">{Math.round(debug.progress)}%</span>
          <span className="text-violet-800">{debug.phase}</span>
          <span className="text-violet-700">{debug.message}</span>
          <span className="text-violet-600">{debug.elapsedMs}ms</span>
          {debug.payloadBytes ? (
            <span className="text-violet-600">payload {formatBytes(debug.payloadBytes)}</span>
          ) : null}
          {props.onRetry ? (
            <button
              type="button"
              onClick={props.onRetry}
              className="rounded border border-violet-200 bg-white px-2 py-0.5 text-violet-800 hover:bg-violet-100"
            >
              Retry
            </button>
          ) : null}
          {props.onClearCache ? (
            <button
              type="button"
              onClick={props.onClearCache}
              className="rounded border border-violet-200 bg-white px-2 py-0.5 text-violet-800 hover:bg-violet-100"
            >
              Clear cache
            </button>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-[width] duration-200"
            style={{ width: `${Math.min(100, Math.max(0, debug.progress))}%` }}
          />
        </div>
        {open ? (
          <div className="max-h-40 overflow-y-auto rounded border border-violet-100 bg-white/80 p-2 font-mono text-[10px] leading-relaxed text-zinc-700">
            {debug.logs.length === 0 ? (
              <p className="text-zinc-400">Waiting for load events…</p>
            ) : (
              debug.logs.map((line, i) => (
                <div key={`${line.t}-${i}`}>
                  <span className="text-violet-600">+{line.t}ms</span> {line.msg}
                </div>
              ))
            )}
            {debug.meta ? (
              <pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-zinc-600">
                {JSON.stringify(debug.meta, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
