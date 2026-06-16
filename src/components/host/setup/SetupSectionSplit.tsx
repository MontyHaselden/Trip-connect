"use client";

import type { ReactNode } from "react";

/** Fixed 50/50 middle workspace: status on top, adds on bottom. */
export function SetupSectionSplit(props: {
  header?: ReactNode;
  status: ReactNode;
  adds: ReactNode;
  footer?: ReactNode;
}) {
  const { header, status, adds, footer } = props;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {header ? <div className="shrink-0 border-b border-zinc-200/80">{header}</div> : null}

      <div className="flex h-1/2 min-h-0 flex-col border-b border-zinc-200">
        <div className="min-h-0 flex-1 overflow-y-auto">{status}</div>
        {footer ? <div className="shrink-0 border-t border-zinc-100">{footer}</div> : null}
      </div>

      <div className="flex h-1/2 min-h-0 flex-col bg-zinc-50/60">{adds}</div>
    </div>
  );
}
