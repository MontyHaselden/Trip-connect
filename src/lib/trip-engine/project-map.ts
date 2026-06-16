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

/** Read-only map projection from the trip graph. */
export function projectMap(graph: TripEntityGraph, groupId?: string): MapProjection {
  const gid = groupId ?? graph.mainGroupId;
  const days = graph.dayPlacesByGroupId[gid] ?? [];
  const pins: MapPin[] = [];
  const routes: MapProjection["routes"] = [];

  for (const day of days) {
    if (day.primaryCity.trim()) {
      pins.push({
        id: `loc-${day.date}-primary`,
        label: day.primaryCity,
        date: day.date,
        kind: "location",
        city: day.primaryCity,
      });
    }
  }

  for (const stay of graph.accommodationStays) {
    if (stay.name?.trim()) {
      pins.push({
        id: `stay-${stay.id}`,
        label: stay.name,
        date: stay.checkInDate,
        kind: "stay",
        city: stay.cityLabel || stay.name,
      });
    }
  }

  for (const activity of graph.activities) {
    if (activity.locationName?.trim() || activity.title.trim()) {
      pins.push({
        id: `act-${activity.id}`,
        label: activity.title,
        date: activity.date,
        kind: "activity",
        city: activity.locationName?.trim() || activity.title,
      });
    }
  }

  for (const leg of graph.intercityLegs) {
    const from = leg.intercityFromCity || leg.fromCity || "";
    const to = leg.intercityToCity || leg.toCity || "";
    if (from && to) {
      routes.push({
        from,
        to,
        date: leg.travelDate,
        label: `${from} → ${to}`,
      });
    }
  }

  return { pins, routes };
}
