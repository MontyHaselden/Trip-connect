"use client";

import type { TripLoadStatus } from "./useTripOsEngine";

export function TripLoadBar(props: { status: TripLoadStatus; visible: boolean }) {
  if (!props.visible || props.status.phase === "ready") return null;

  const { status } = props;
  const label = status.message.trim() || "Loading trip…";

  return (
    <div className="shrink-0 border-b border-zinc-100 bg-white/95 px-4 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(4, status.progress))}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
