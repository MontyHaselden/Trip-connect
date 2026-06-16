"use client";

import type { ReactNode } from "react";

/** Right-hand setup canvas: optional toolbar + scrollable main area. */
export function SetupWorkspace(props: {
  toolbar?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  /** When true, children manage their own scroll (e.g. calendar canvas). */
  childScroll?: boolean;
}) {
  const { toolbar, banner, children, childScroll } = props;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {toolbar ? <div className="shrink-0 border-b border-zinc-200/80 bg-white">{toolbar}</div> : null}
      {banner ? <div className="shrink-0">{banner}</div> : null}
      <div
        className={[
          "min-h-0 flex-1",
          childScroll ? "flex flex-col overflow-hidden" : "overflow-y-auto",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
