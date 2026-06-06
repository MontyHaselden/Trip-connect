"use client";

import { dayDensityLabel } from "@/lib/utils/day-density";

export function DayDensityBadge(props: { itemCount: number }) {
  const { count, label } = dayDensityLabel(props.itemCount);
  if (count === 0) return null;

  return (
    <p className="text-[11px] font-medium text-zinc-500">
      {count} {count === 1 ? "activity" : "activities"} · {label}
    </p>
  );
}
