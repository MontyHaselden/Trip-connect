"use client";

import { useMemo } from "react";

import { projectMap } from "@/lib/trip-engine/project-map";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

export function MapView(props: { graph: TripEntityGraph; groupId: string }) {
  const projection = useMemo(
    () => projectMap(props.graph, props.groupId),
    [props.graph, props.groupId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Map projection</h2>
        <p className="text-sm text-zinc-600">
          Read-only pins and routes from the trip graph — updates on every command.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Pins</p>
        <ul className="mt-3 space-y-2">
          {projection.pins.map((pin) => (
            <li
              key={pin.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <span className="text-lg">
                {pin.kind === "stay" ? "🏨" : pin.kind === "activity" ? "★" : "📍"}
              </span>
              <div>
                <p className="font-medium">{pin.label}</p>
                <p className="text-xs text-zinc-500">
                  {pin.date} · {pin.city}
                </p>
              </div>
            </li>
          ))}
          {!projection.pins.length ? (
            <li className="text-sm text-zinc-500">No map pins yet — paint locations or add activities.</li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Routes</p>
        <ul className="mt-3 space-y-2">
          {projection.routes.map((route, i) => (
            <li
              key={`${route.date}-${i}`}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
            >
              {route.date}: {route.label}
            </li>
          ))}
          {!projection.routes.length ? (
            <li className="text-sm text-zinc-500">No transport corridors yet.</li>
          ) : null}
        </ul>
      </div>

      <p className="text-xs text-zinc-500">
        Student app timeline reads the published snapshot built from this same graph.
      </p>
    </div>
  );
}
