"use client";

import { useState } from "react";

import { buildMapsSearchUrl } from "@/lib/utils/maps";
import {
  inferKind,
  itemExtraInfoLines,
  itemLocationLine,
  kindAccent,
  type ItineraryRowItem,
} from "@/lib/utils/itinerary-item-style";
import { formatItineraryTimeRange } from "@/lib/utils/time";
import type { TimelineBlockLayout } from "@/lib/timeline/types";

function ItemInfoButton(props: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        props.onToggle();
      }}
      aria-expanded={props.expanded}
      aria-label={props.expanded ? "Hide details" : "Show details"}
      className={[
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        props.expanded
          ? "bg-zinc-800 text-white"
          : "bg-white/80 text-zinc-700 ring-1 ring-inset ring-zinc-300",
      ].join(" ")}
    >
      !
    </button>
  );
}

export function TimelineBlock(props: {
  item: ItineraryRowItem;
  layout: TimelineBlockLayout;
  tripTimezone: string;
  mapsEnabled: boolean;
  isActive: boolean;
  mode: "view" | "edit";
  isDragging?: boolean;
  onBlockClick?: () => void;
  onResizeStart?: (edge: "start" | "end", e: React.PointerEvent) => void;
  onDragStart?: (e: React.PointerEvent) => void;
}) {
  const {
    item,
    layout,
    tripTimezone,
    mapsEnabled,
    isActive,
    mode,
    isDragging,
    onBlockClick,
    onResizeStart,
    onDragStart,
  } = props;

  const [expanded, setExpanded] = useState(false);
  const kind = inferKind(item.title);
  const accent = kindAccent(kind);
  const locationLine = itemLocationLine(item);
  const extraLines = itemExtraInfoLines(item);
  const mapsQuery = item.mapQuery || item.address || "";
  const mapsUrl = mapsQuery ? buildMapsSearchUrl(mapsQuery) : null;
  const hasDetails = extraLines.length > 0 || Boolean(mapsUrl && mapsEnabled);
  const timeLabel = formatItineraryTimeRange(
    item.startTime,
    item.endTime,
    tripTimezone,
  );
  const editMode = mode === "edit";
  const tallEnough = layout.heightPx >= 56;

  return (
    <div
      className={[
        "absolute box-border overflow-hidden rounded-lg border px-2 py-1 shadow-sm",
        accent.featured,
        isActive ? "ring-2 ring-red-400 ring-offset-1" : "ring-1 ring-inset ring-black/5",
        isDragging ? "opacity-80 shadow-md" : "",
        editMode ? "cursor-grab active:cursor-grabbing" : "",
      ].join(" ")}
      style={{
        top: layout.topPx,
        height: layout.heightPx,
        left: `calc(${layout.leftPercent}% + 2px)`,
        width: `calc(${layout.widthPercent}% - 4px)`,
      }}
      onClick={(e) => {
        if (editMode) {
          e.stopPropagation();
          onBlockClick?.();
        }
      }}
      onPointerDown={(e) => {
        if (!editMode || !onDragStart) return;
        if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
        onDragStart(e);
      }}
    >
      {editMode ? (
        <>
          <div
            data-resize-handle
            className="absolute inset-x-2 top-0 h-2 cursor-ns-resize"
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart?.("start", e);
            }}
          />
          <div
            data-resize-handle
            className="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize"
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart?.("end", e);
            }}
          />
        </>
      ) : null}

      <div className="flex min-h-0 flex-col gap-0.5">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium tabular-nums text-zinc-600">
              {timeLabel}
            </p>
            {tallEnough ? (
              <>
                <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-zinc-900">
                  {item.title}
                </p>
                {locationLine ? (
                  <p className="truncate text-[10px] text-zinc-500">{locationLine}</p>
                ) : null}
              </>
            ) : (
              <p className="truncate text-xs font-semibold text-zinc-900">{item.title}</p>
            )}
          </div>
          {!editMode && hasDetails ? (
            <ItemInfoButton expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
          ) : null}
        </div>

        {!editMode && expanded && hasDetails ? (
          <div className="mt-1 space-y-0.5 border-t border-zinc-200/80 pt-1 text-[10px] leading-relaxed text-zinc-600">
            {extraLines.map((line, i) => (
              <p key={i} className="break-words">
                {line}
              </p>
            ))}
            {mapsUrl && mapsEnabled ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex font-medium text-zinc-700 underline"
                onClick={(e) => e.stopPropagation()}
              >
                Map
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
