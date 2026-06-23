"use client";

import type { TripMapCategory } from "@/lib/trip-engine/map-types";

import { ALL_MAP_CATEGORIES, MAP_CATEGORY_LABELS } from "./map-marker-styles";

export function MapToolbar(props: {
  categories: Set<TripMapCategory>;
  onToggleCategory: (category: TripMapCategory) => void;
  missingCount: number;
  onFitTrip: () => void;
  onFocusDay: () => void;
  canFocusDay: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2">
      <div className="flex flex-wrap gap-1.5">
        {ALL_MAP_CATEGORIES.map((cat) => {
          const on = props.categories.has(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => props.onToggleCategory(cat)}
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                on
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              ].join(" ")}
            >
              {MAP_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {props.missingCount > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            {props.missingCount} missing coordinates
          </span>
        ) : null}
        <button
          type="button"
          onClick={props.onFitTrip}
          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Fit trip
        </button>
        <button
          type="button"
          onClick={props.onFocusDay}
          disabled={!props.canFocusDay}
          className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Focus selected day
        </button>
      </div>
    </div>
  );
}
