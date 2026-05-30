"use client";

import { minutesToTopPx } from "@/lib/timeline/time-math";

export function NowLine(props: { nowMinutes: number }) {
  const top = minutesToTopPx(props.nowMinutes);
  return (
    <div
      className="pointer-events-none absolute right-0 left-0 z-20"
      style={{ top }}
      aria-hidden
    >
      <div className="relative flex items-center">
        <span className="absolute -left-1 -translate-x-full rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Now
        </span>
        <div className="h-0.5 w-full bg-red-500 shadow-sm" />
      </div>
    </div>
  );
}
