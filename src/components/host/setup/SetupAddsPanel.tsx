"use client";

import type { ReactNode } from "react";

/** Bottom-half shell shared by day panel and section panels. */
export function SetupAddsPanel(props: { headerExtra?: ReactNode; children: ReactNode }) {
  const { headerExtra, children } = props;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-zinc-200/80 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Adds</p>
        {headerExtra ? <div className="mt-2">{headerExtra}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </div>
  );
}
