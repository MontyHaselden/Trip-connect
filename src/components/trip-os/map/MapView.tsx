"use client";

import { useMemo } from "react";

import { projectMap } from "@/lib/trip-engine/project-map";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { TripEyebrow } from "../shared/TripEyebrow";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

export function MapView(props: { graph: TripEntityGraph; groupId: string }) {
  const projection = useMemo(
    () => projectMap(props.graph, props.groupId),
    [props.graph, props.groupId],
  );

  return (
    <TripSectionShell
      eyebrow="Projection"
      title="Map"
      description="Read-only pins and routes from the trip graph — updates on every command."
    >
      <TripSoftPanel>
        <TripEyebrow>Pins</TripEyebrow>
        <ul className="mt-3 space-y-2">
          {projection.pins.map((pin) => (
            <li
              key={pin.id}
              className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
            >
              <span className="text-lg">
                {pin.kind === "stay" ? "🏨" : pin.kind === "activity" ? "★" : "📍"}
              </span>
              <div>
                <p className="font-medium text-zinc-900">{pin.label}</p>
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
      </TripSoftPanel>

      <TripSoftPanel>
        <TripEyebrow>Routes</TripEyebrow>
        <ul className="mt-3 space-y-2">
          {projection.routes.map((route, i) => (
            <li
              key={`${route.date}-${i}`}
              className="rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-900"
            >
              {route.date}: {route.label}
            </li>
          ))}
          {!projection.routes.length ? (
            <li className="text-sm text-zinc-500">No transport corridors yet.</li>
          ) : null}
        </ul>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
