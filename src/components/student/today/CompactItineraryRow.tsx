"use client";

import {
  COMPACT_SHORT_THRESHOLD_MINUTES,
} from "@/lib/timeline/compact-day-layout";
import { useTypewriterText } from "@/hooks/useTypewriterText";
import {
  categoryAccent,
  formatCompactStartTime,
  resolveCategory,
  type ItineraryRowItem,
} from "@/lib/utils/itinerary-item-style";

function titleSizeClass(durationMinutes: number, blockHeightPx: number) {
  if (durationMinutes >= 180 || blockHeightPx >= 200) return "text-2xl font-bold leading-tight";
  if (durationMinutes >= 90 || blockHeightPx >= 120) return "text-xl font-semibold leading-snug";
  if (durationMinutes >= 60 || blockHeightPx >= 80) return "text-base font-semibold leading-snug";
  return "text-sm font-medium leading-snug";
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
  durationMinutes: number;
  heightPx: number;
  animateIn?: boolean;
  typewriterTitle?: boolean;
}) {
  const {
    item,
    tripTimezone,
    isActive,
    isNext,
    onTap,
    durationMinutes,
    heightPx,
    animateIn,
    typewriterTitle,
  } = props;
  const category = resolveCategory(item);
  const accent = categoryAccent(category);
  const time = formatCompactStartTime(item.startTime, tripTimezone);
  const isShort = durationMinutes <= COMPACT_SHORT_THRESHOLD_MINUTES;
  const title = useTypewriterText(item.title, Boolean(typewriterTitle));

  return (
    <button
      type="button"
      onClick={onTap}
      style={{ height: heightPx, flexShrink: 0 }}
      className={[
        "flex w-full flex-col justify-center gap-0.5 overflow-hidden border-b border-zinc-200/70 px-3 py-2 text-left transition-colors last:border-b-0",
        blockTint(category, Boolean(isActive), Boolean(isNext) && !isActive),
        isActive ? "ring-2 ring-inset ring-red-200" : "",
        animateIn ? "animate-block-in" : "",
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
        <span className="truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {accent.label}
        </span>
      </div>
      <span
        className={[
          "min-w-0 text-zinc-900",
          titleSizeClass(durationMinutes, heightPx),
          isShort ? "line-clamp-2" : heightPx < 100 ? "line-clamp-2" : "line-clamp-3",
        ].join(" ")}
      >
        {title}
        {typewriterTitle && title.length < item.title.length ? (
          <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-zinc-400 align-middle" />
        ) : null}
      </span>
    </button>
  );
}
