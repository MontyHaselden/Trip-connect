"use client";

import L from "leaflet";

import type { TripMapCategory } from "@/lib/trip-engine/map-types";

import { MAP_MARKER_COLORS } from "./map-marker-styles";

export function createCategoryDivIcon(category: TripMapCategory, highlighted: boolean): L.DivIcon {
  const color = MAP_MARKER_COLORS[category];
  const size = highlighted ? 28 : 22;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:2px solid ${highlighted ? "#fff" : "rgba(255,255,255,0.9)"};
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,0.25)${highlighted ? ",0 0 0 3px rgba(124,58,237,0.5)" : ""};
    "></div>`,
  });
}
