"use client";

import type { TripMapMarker, TripMapRouteLine } from "@/lib/trip-engine/map-types";

import { categoryIcon } from "./map-marker-styles";

export function MapSideList(props: {
  markers: TripMapMarker[];
  routes: TripMapRouteLine[];
  selectedMarkerId: string | null;
  selectedRouteId: string | null;
  highlightedDate: string | null;
  onSelectMarker: (id: string) => void;
  onSelectRoute: (id: string) => void;
}) {
  const byDate = new Map<string, Array<{ kind: "marker" | "route"; item: TripMapMarker | TripMapRouteLine }>>();
  for (const m of props.markers) {
    const list = byDate.get(m.date) ?? [];
    list.push({ kind: "marker", item: m });
    byDate.set(m.date, list);
  }
  for (const r of props.routes) {
    const list = byDate.get(r.date) ?? [];
    list.push({ kind: "route", item: r });
    byDate.set(r.date, list);
  }
  const dates = [...byDate.keys()].sort();

  if (!dates.length) {
    return (
      <p className="px-3 py-4 text-sm text-zinc-500">
        No mapped items yet. Add coordinates to accommodation to see pins on the map.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-100 overflow-y-auto">
      {dates.map((date) => (
        <li key={date}>
          <p className="sticky top-0 bg-zinc-50/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {date}
          </p>
          <ul>
            {(byDate.get(date) ?? []).map((entry) => {
              if (entry.kind === "marker") {
                const m = entry.item as TripMapMarker;
                const selected = props.selectedMarkerId === m.id;
                const dateHighlight =
                  props.highlightedDate && m.date === props.highlightedDate;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => props.onSelectMarker(m.id)}
                      className={[
                        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition",
                        selected || dateHighlight
                          ? "bg-violet-50"
                          : "hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <span>{categoryIcon(m.category)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900">
                          {m.title}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {m.subtitle}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              }
              const r = entry.item as TripMapRouteLine;
              const selected = props.selectedRouteId === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => props.onSelectRoute(r.id)}
                    className={[
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition",
                      selected ? "bg-blue-50" : "hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    <span>↔</span>
                    <span className="min-w-0 truncate font-medium text-zinc-900">
                      {r.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
