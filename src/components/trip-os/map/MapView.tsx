"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import type { TripMapCategory, TripMapMarker, TripMapRouteLine } from "@/lib/trip-engine/map-types";
import { projectTripMap } from "@/lib/trip-engine/project-trip-map";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import type { CalendarSelection } from "../calendar/useCalendarSelection";
import type { TripOsSection } from "../TripOsWorkspace";
import { TripEyebrow } from "../shared/TripEyebrow";
import { TripSectionShell } from "../shared/TripSectionShell";

import { ALL_MAP_CATEGORIES } from "./map-marker-styles";
import { MapNeedsCoordinatesPanel } from "./MapNeedsCoordinatesPanel";
import { MapSideList } from "./MapSideList";
import { MapToolbar } from "./MapToolbar";

const TripMapCanvas = dynamic(
  () => import("./TripMapCanvas").then((m) => m.TripMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-500">
        Loading map…
      </div>
    ),
  },
);

function boundsForDay(
  markers: TripMapMarker[],
  routes: TripMapRouteLine[],
  date: string,
) {
  const points: Array<{ lat: number; lng: number }> = [];
  for (const m of markers) {
    if (m.date === date || (m.startDate && m.endDate && m.startDate <= date && date <= m.endDate)) {
      points.push({ lat: m.lat, lng: m.lng });
    }
  }
  for (const r of routes) {
    if (r.date === date) {
      points.push(
        { lat: r.fromLat, lng: r.fromLng },
        { lat: r.toLat, lng: r.toLng },
      );
    }
  }
  if (!points.length) return null;
  let south = points[0]!.lat;
  let north = points[0]!.lat;
  let west = points[0]!.lng;
  let east = points[0]!.lng;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  const pad = 0.02;
  return { south: south - pad, north: north + pad, west: west - pad, east: east + pad };
}

export function MapView(props: {
  graph: TripEntityGraph;
  groupId: string;
  calendarSelection: CalendarSelection;
  onHighlightDay: (iso: string) => void;
  onGoToDate: (iso: string) => void;
  onNavigateSection: (section: TripOsSection) => void;
}) {
  const [categories, setCategories] = useState<Set<TripMapCategory>>(
    () => new Set(ALL_MAP_CATEGORIES),
  );
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [missingCollapsed, setMissingCollapsed] = useState(false);
  const [fitTripTrigger, setFitTripTrigger] = useState(0);
  const [focusDayTrigger, setFocusDayTrigger] = useState(0);

  const projection = useMemo(
    () => projectTripMap(props.graph, { groupId: props.groupId, categories }),
    [props.graph, props.groupId, categories],
  );

  const highlightedDate = props.calendarSelection.rangeStart;

  const focusDayBounds = useMemo(() => {
    if (!highlightedDate) return null;
    return boundsForDay(projection.markers, projection.routeLines, highlightedDate);
  }, [highlightedDate, projection.markers, projection.routeLines]);

  const toggleCategory = useCallback((cat: TripMapCategory) => {
    setCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const handleOpenItem = useCallback(
    (section: TripOsSection, linkedDay: string) => {
      props.onHighlightDay(linkedDay);
      props.onNavigateSection(section);
    },
    [props],
  );

  const handleMarkerClick = useCallback(
    (marker: TripMapMarker) => {
      setSelectedMarkerId(marker.id);
      setSelectedRouteId(null);
      props.onHighlightDay(marker.linkedCalendarDay);
    },
    [props],
  );

  const handleRouteClick = useCallback(
    (route: TripMapRouteLine) => {
      setSelectedRouteId(route.id);
      setSelectedMarkerId(null);
      props.onHighlightDay(route.date);
    },
    [props],
  );

  const hasMappedContent = projection.markers.length > 0 || projection.routeLines.length > 0;

  return (
    <TripSectionShell
      eyebrow="Projection"
      title="Map"
      description="Live trip map from the itinerary graph — read-only, updates on every command."
      fill
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/50 shadow-sm">
        <MapToolbar
          categories={categories}
          onToggleCategory={toggleCategory}
          missingCount={projection.missingCoordinates.length}
          onFitTrip={() => setFitTripTrigger((n) => n + 1)}
          onFocusDay={() => setFocusDayTrigger((n) => n + 1)}
          canFocusDay={Boolean(highlightedDate && focusDayBounds)}
        />

        <div className="flex min-h-0 flex-1">
          <div className="relative min-h-[320px] min-w-0 flex-1 p-2">
            {!hasMappedContent ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white px-6 text-center">
                <TripEyebrow>No map data yet</TripEyebrow>
                <p className="mt-2 max-w-md text-sm text-zinc-600">
                  No mapped locations yet. Add coordinates to locations, accommodation,
                  transport, or activities to see the trip map.
                </p>
              </div>
            ) : (
              <TripMapCanvas
                markers={projection.markers}
                routes={projection.routeLines}
                bounds={projection.bounds}
                selectedMarkerId={selectedMarkerId}
                selectedRouteId={selectedRouteId}
                highlightedDate={highlightedDate}
                fitTripTrigger={fitTripTrigger}
                focusDayTrigger={focusDayTrigger}
                focusDayBounds={focusDayBounds}
                onMarkerClick={handleMarkerClick}
                onRouteClick={handleRouteClick}
                onOpenItem={handleOpenItem}
                onGoToDate={props.onGoToDate}
              />
            )}
          </div>

          <aside className="hidden w-56 shrink-0 flex-col border-l border-zinc-200 bg-white lg:flex xl:w-64">
            <p className="shrink-0 border-b border-zinc-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              On the map
            </p>
            <div className="min-h-0 flex-1 overflow-hidden">
              <MapSideList
                markers={projection.markers}
                routes={projection.routeLines}
                selectedMarkerId={selectedMarkerId}
                selectedRouteId={selectedRouteId}
                highlightedDate={highlightedDate}
                onSelectMarker={(id) => {
                  const m = projection.markers.find((x) => x.id === id);
                  if (m) handleMarkerClick(m);
                }}
                onSelectRoute={(id) => {
                  const r = projection.routeLines.find((x) => x.id === id);
                  if (r) handleRouteClick(r);
                }}
              />
            </div>
          </aside>
        </div>

        <MapNeedsCoordinatesPanel
          items={projection.missingCoordinates}
          collapsed={missingCollapsed}
          onToggleCollapsed={() => setMissingCollapsed((c) => !c)}
          onOpenItem={handleOpenItem}
        />
      </div>
    </TripSectionShell>
  );
}
