"use client";

import type { ReactNode } from "react";

import type { ItineraryRowItem } from "@/lib/utils/itinerary-item-style";

import { RunSheetRow } from "./RunSheetRow";

export function RunSheetTimeline(props: {
  items: ItineraryRowItem[];
  tripTimezone: string;
  activeId: string | null;
  nextId: string | null;
  heightsById: Map<string, number>;
  needsScroll: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  onTapItem: (item: ItineraryRowItem) => void;
  animateItemIds?: Set<string>;
  typewriterItemId?: string | null;
  listFooter?: ReactNode;
  timelessItemIds?: Set<string>;
}) {
  const {
    items,
    tripTimezone,
    activeId,
    nextId,
    heightsById,
    needsScroll,
    listRef,
    onTapItem,
    animateItemIds,
    typewriterItemId,
    listFooter,
    timelessItemIds,
  } = props;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={listRef}
        className={[
          "student-app-scroll no-scrollbar flex min-h-0 flex-1 flex-col overscroll-y-contain",
          needsScroll ? "overflow-y-auto" : "overflow-hidden",
        ].join(" ")}
      >
        <div
          className={[
            "flex flex-col rounded-xl bg-[var(--student-surface)] shadow-sm ring-1 ring-[var(--student-line)]/80",
            needsScroll ? "shrink-0" : "h-full min-h-0 flex-1",
          ].join(" ")}
        >
          {items.map((item, index) => (
            <RunSheetRow
              key={item.id}
              item={item}
              tripTimezone={tripTimezone}
              isActive={item.id === activeId}
              isNext={item.id === nextId && item.id !== activeId}
              isLast={index === items.length - 1}
              heightPx={heightsById.get(item.id) ?? 56}
              onTap={() => onTapItem(item)}
              animateIn={animateItemIds?.has(item.id)}
              typewriterTitle={typewriterItemId === item.id}
              timeless={timelessItemIds?.has(item.id)}
            />
          ))}
        </div>
      </div>
      {listFooter ? <div className="mt-2 shrink-0">{listFooter}</div> : null}
    </div>
  );
}
