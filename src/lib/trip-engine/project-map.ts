import { projectTripMap } from "./project-trip-map";
import type { TripEntityGraph } from "./types";

export type MapPin = {
  id: string;
  label: string;
  date: string;
  kind: "location" | "stay" | "activity";
  city: string;
};

export type MapProjection = {
  pins: MapPin[];
  routes: Array<{ from: string; to: string; date: string; label: string }>;
};

export type { TripMapProjection, TripMapMarker, TripMapRouteLine, NeedsCoordinatesItem } from "./map-types";
export { projectTripMap, MAP_MARKER_COLORS } from "./project-trip-map";

/** @deprecated Use projectTripMap — kept for compatibility. */
export function projectMap(graph: TripEntityGraph, groupId?: string): MapProjection {
  const gid = groupId ?? graph.mainGroupId;
  const projection = projectTripMap(graph, { groupId: gid });
  const pins: MapPin[] = [
    ...projection.markers.map((m) => ({
      id: m.id,
      label: m.title,
      date: m.date,
      kind:
        m.entityType === "accommodation"
          ? ("stay" as const)
          : m.entityType === "activity"
            ? ("activity" as const)
            : ("location" as const),
      city: m.city,
    })),
    ...projection.missingCoordinates.map((m) => ({
      id: m.id,
      label: m.title,
      date: m.date,
      kind:
        m.entityType === "accommodation"
          ? ("stay" as const)
          : m.entityType === "activity"
            ? ("activity" as const)
            : ("location" as const),
      city: m.city,
    })),
  ];
  const routes = projection.routeLines.map((r) => ({
    from: r.fromTitle,
    to: r.toTitle,
    date: r.date,
    label: r.title,
  }));
  return { pins, routes };
}
