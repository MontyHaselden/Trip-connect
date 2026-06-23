"use client";

import type { NeedsCoordinatesItem } from "@/lib/trip-engine/map-types";
import type { TripOsSection } from "../TripOsWorkspace";

import { categoryIcon } from "./map-marker-styles";

export function MapNeedsCoordinatesPanel(props: {
  items: NeedsCoordinatesItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenItem: (section: TripOsSection, linkedDay: string) => void;
}) {
  if (!props.items.length) return null;

  return (
    <div className="shrink-0 border-t border-zinc-200 bg-amber-50/80">
      <button
        type="button"
        onClick={props.onToggleCollapsed}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-sm font-medium text-amber-900"
      >
        <span>Needs coordinates ({props.items.length})</span>
        <span className="text-xs">{props.collapsed ? "Show" : "Hide"}</span>
      </button>
      {!props.collapsed ? (
        <ul className="max-h-40 overflow-y-auto border-t border-amber-100 px-2 pb-2">
          {props.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span>{categoryIcon(item.category)}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{item.title}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {item.city} · {item.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-violet-700 hover:text-violet-900"
                onClick={() =>
                  props.onOpenItem(item.sectionId as TripOsSection, item.linkedCalendarDay)
                }
              >
                Open item
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
