"use client";

import {
  categoryAccent,
  formatCompactStartTime,
  itemLocationLine,
  resolveCategory,
  type ItineraryRowItem,
} from "@/lib/utils/itinerary-item-style";

function titleSizeClass(totalCount: number) {
  if (totalCount <= 1) return "text-2xl font-bold leading-tight";
  if (totalCount <= 2) return "text-xl font-semibold leading-snug";
  if (totalCount <= 4) return "text-base font-semibold leading-snug";
  if (totalCount <= 6) return "text-sm font-medium leading-snug";
  return "text-xs font-medium leading-snug";
}

function blockTint(category: ReturnType<typeof resolveCategory>, isActive: boolean, isNext: boolean) {
  if (isActive) return "bg-red-50";
  if (isNext) return "bg-zinc-50";
  switch (category) {
    case "travel":
      return "bg-sky-50/80";
    case "meal":
      return "bg-amber-50/80";
    case "school":
      return "bg-indigo-50/70";
    case "activity":
      return "bg-violet-50/70";
    case "hotel":
      return "bg-teal-50/80";
    case "meeting":
      return "bg-rose-50/70";
    case "important":
      return "bg-emerald-50/80";
    default:
      return "bg-white";
  }
}

export function CompactItineraryRow(props: {
  item: ItineraryRowItem;
  tripTimezone: string;
  isActive?: boolean;
  isNext?: boolean;
  onTap: () => void;
  totalCount: number;
}) {
  const { item, tripTimezone, isActive, isNext, onTap, totalCount } = props;
  const category = resolveCategory(item);
  const accent = categoryAccent(category);
  const time = formatCompactStartTime(item.startTime, tripTimezone);
  const locationLine = itemLocationLine(item);
  const showLocation = Boolean(locationLine) && totalCount <= 4;

  return (
    <button
      type="button"
      onClick={onTap}
      className={[
        "flex min-h-0 flex-1 flex-col justify-center gap-0.5 border-b border-zinc-200/70 px-3 py-2 text-left transition-colors",
        blockTint(category, Boolean(isActive), Boolean(isNext) && !isActive),
        isActive ? "ring-2 ring-inset ring-red-200" : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            isActive ? "bg-red-400" : accent.dot,
          ].join(" ")}
          aria-hidden
        />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-600">
          {time}
        </span>
        <span
          className={[
            "truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500",
            totalCount > 6 ? "hidden" : "",
          ].join(" ")}
        >
          {accent.label}
        </span>
      </div>
      <span
        className={[
          "min-w-0 text-zinc-900",
          titleSizeClass(totalCount),
          totalCount > 6 ? "line-clamp-2" : totalCount > 3 ? "line-clamp-3" : "",
        ].join(" ")}
      >
        {item.title}
      </span>
      {showLocation ? (
        <span className="truncate text-xs text-zinc-500">{locationLine}</span>
      ) : null}
    </button>
  );
}
