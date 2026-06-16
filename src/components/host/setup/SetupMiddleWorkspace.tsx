"use client";

import type { ReactNode } from "react";

export function SetupMiddleWorkspace(props: {
  children: ReactNode | null;
  onEmptyClick?: () => void;
}) {
  const { children, onEmptyClick } = props;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-white">
      {children ? (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
      ) : (
        <button
          type="button"
          onClick={onEmptyClick}
          className="flex h-full min-h-[200px] w-full items-center justify-center px-6 text-left hover:bg-zinc-50"
        >
          <p className="max-w-xs text-center text-sm text-zinc-400">
            Select days on the calendar or choose a section to work here.
          </p>
        </button>
      )}
    </div>
  );
}
