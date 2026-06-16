"use client";

import { useTypewriterText } from "@/hooks/useTypewriterText";
import {
  categoryAccent,
  formatCompactStartTime,
  resolveCategory,
  type ItineraryRowItem,
} from "@/lib/utils/itinerary-item-style";
import { formatItineraryTimeRange } from "@/lib/utils/time";
import { PROPORTIONAL_MIN_ROW_HEIGHT_PX } from "@/lib/timeline/proportional-day-rows";

export function RunSheetRow(props: {
  item: ItineraryRowItem;
  tripTimezone: string;
  isActive?: boolean;
  isNext?: boolean;
  isLast?: boolean;
  heightPx: number;
  onTap: () => void;
  animateIn?: boolean;
  typewriterTitle?: boolean;
}) {
  const {
    item,
    tripTimezone,
    isActive,
    isNext,
    isLast,
    heightPx,
    onTap,
    animateIn,
    typewriterTitle,
  } = props;

  const category = resolveCategory(item);
  const accent = categoryAccent(category);
  const time =
    item.endTime && item.endTime !== item.startTime
      ? formatItineraryTimeRange(item.startTime, item.endTime, tripTimezone)
      : formatCompactStartTime(item.startTime, tripTimezone);
  const title = useTypewriterText(item.title, Boolean(typewriterTitle));

  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        height: heightPx,
        minHeight: PROPORTIONAL_MIN_ROW_HEIGHT_PX,
        flexShrink: 0,
      }}
      className={[
        "group relative flex w-full items-center gap-3 py-2.5 pl-0 pr-1 text-left transition-colors",
        isActive ? "bg-[var(--student-nav)]/[0.04]" : "hover:bg-[var(--student-line)]/30",
        animateIn ? "animate-block-in" : "",
      ].join(" ")}
    >
      <div className="relative flex h-full w-8 shrink-0 flex-col items-center self-stretch">
        {!isLast ? (
          <span
            className="absolute top-[18px] bottom-0 w-[2px] bg-[var(--student-line)]"
            aria-hidden
          />
        ) : null}
        <span
          className={[
            "relative z-[1] mt-2.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--student-bg)]",
            accent.dot,
            isActive ? "ring-[var(--student-nav)]/25" : "",
            isNext && !isActive ? "ring-[var(--student-accent)]/30" : "",
          ].join(" ")}
          aria-hidden
        />
      </div>

      <div className="min-w-0 flex-1 self-stretch border-b border-[var(--student-line)] pb-2.5 group-last:border-b-0">
        <div className="flex h-full items-center gap-2">
          <span className="w-16 shrink-0 text-[10px] font-semibold leading-tight tabular-nums text-[var(--student-text-muted)]">
            {time}
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-[var(--student-text)]">
            {title}
            {typewriterTitle && title.length < item.title.length ? (
              <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-[var(--student-text-muted)] align-middle" />
            ) : null}
          </span>
        </div>
      </div>
    </button>
  );
}
