"use client";

import { useEffect, useRef } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";

import { configureLeafletDefaultIcons } from "@/lib/map/leaflet-icons";
import { greatCircleArc } from "@/lib/map/route-geometry";
import { getMapTileConfig } from "@/lib/map/tile-config";
import type { TripMapBounds, TripMapMarker, TripMapRouteLine } from "@/lib/trip-engine/map-types";

import { createCategoryDivIcon } from "./TripMapMarkerIcon";
import { TripMapPopup } from "./TripMapPopup";
import type { TripOsSection } from "../TripOsWorkspace";

import "leaflet/dist/leaflet.css";

function FitBoundsOnLoad(props: {
  bounds: TripMapBounds | null;
  fitKey: string;
  singleCenter: LatLngExpression | null;
}) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (lastKey.current === props.fitKey) return;
    lastKey.current = props.fitKey;

    if (props.bounds) {
      const b: LatLngBoundsExpression = [
        [props.bounds.south, props.bounds.west],
        [props.bounds.north, props.bounds.east],
      ];
      map.fitBounds(b, { padding: [40, 40], maxZoom: 12 });
    } else if (props.singleCenter) {
      map.setView(props.singleCenter, 12);
    }
  }, [map, props.bounds, props.fitKey, props.singleCenter]);

  return null;
}

function MapFitController(props: {
  bounds: TripMapBounds | null;
  trigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!props.trigger || !props.bounds) return;
    map.fitBounds(
      [
        [props.bounds.south, props.bounds.west],
        [props.bounds.north, props.bounds.east],
      ],
      { padding: [40, 40], maxZoom: 12 },
    );
  }, [map, props.bounds, props.trigger]);

  return null;
}

function MapFocusDayController(props: {
  bounds: TripMapBounds | null;
  trigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!props.trigger || !props.bounds) return;
    map.fitBounds(
      [
        [props.bounds.south, props.bounds.west],
        [props.bounds.north, props.bounds.east],
      ],
      { padding: [60, 60], maxZoom: 14 },
    );
  }, [map, props.bounds, props.trigger]);

  return null;
}

export function TripMapCanvas(props: {
  markers: TripMapMarker[];
  routes: TripMapRouteLine[];
  bounds: TripMapBounds | null;
  selectedMarkerId: string | null;
  selectedRouteId: string | null;
  highlightedDate: string | null;
  fitTripTrigger: number;
  focusDayTrigger: number;
  focusDayBounds: TripMapBounds | null;
  onMarkerClick: (marker: TripMapMarker) => void;
  onRouteClick: (route: TripMapRouteLine) => void;
  onOpenItem: (section: TripOsSection, linkedDay: string) => void;
  onGoToDate: (date: string) => void;
}) {
  configureLeafletDefaultIcons();
  const tiles = getMapTileConfig();

  const defaultCenter: LatLngExpression = props.markers[0]
    ? [props.markers[0].lat, props.markers[0].lng]
    : [35.6762, 139.6503];

  const initialFitKey = `${props.markers.length}-${props.routes.length}`;

  function markerHighlighted(m: TripMapMarker): boolean {
    if (props.selectedMarkerId === m.id) return true;
    if (props.highlightedDate && m.date === props.highlightedDate) return true;
    if (props.highlightedDate && m.startDate && m.endDate) {
      return m.startDate <= props.highlightedDate && props.highlightedDate <= m.endDate;
    }
    return false;
  }

  return (
    <MapContainer
      center={defaultCenter}
      zoom={5}
      className="h-full w-full rounded-xl"
      scrollWheelZoom
    >
      <TileLayer
        attribution={tiles.attribution}
        url={tiles.url}
        subdomains={tiles.subdomains}
      />
      <FitBoundsOnLoad
        bounds={props.bounds}
        fitKey={initialFitKey}
        singleCenter={
          props.markers.length === 1
            ? [props.markers[0]!.lat, props.markers[0]!.lng]
            : null
        }
      />
      <MapFitController bounds={props.bounds} trigger={props.fitTripTrigger} />
      <MapFocusDayController bounds={props.focusDayBounds} trigger={props.focusDayTrigger} />

      {props.routes.map((route) => {
        const selected = props.selectedRouteId === route.id;
        const isFlight = route.mode === "flight";
        const dashed =
          isFlight || route.status === "flexible" || route.status === "not_booked";
        const positions = isFlight
          ? greatCircleArc(
              { lat: route.fromLat, lng: route.fromLng },
              { lat: route.toLat, lng: route.toLng },
            )
          : ([
              [route.fromLat, route.fromLng],
              [route.toLat, route.toLng],
            ] as Array<[number, number]>);
        return (
          <Polyline
            key={route.id}
            positions={positions}
            pathOptions={{
              color: selected ? "#4f46e5" : isFlight ? "#6366f1" : "#2563eb",
              weight: selected ? 4 : 3,
              opacity: selected ? 1 : 0.75,
              dashArray: dashed ? "8 10" : undefined,
            }}
            eventHandlers={{
              click: () => props.onRouteClick(route),
            }}
          >
            <Popup>
              <TripMapPopup
                title={route.title}
                date={route.date}
                extraLines={[
                  `Mode: ${route.mode}`,
                  route.bookingReference
                    ? `Ref: ${route.bookingReference}`
                    : "",
                ].filter(Boolean)}
                popupData={route.popupData}
                onOpenItem={props.onOpenItem}
                onGoToDate={props.onGoToDate}
              />
            </Popup>
          </Polyline>
        );
      })}

      {props.markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={createCategoryDivIcon(marker.category, markerHighlighted(marker))}
          eventHandlers={{
            click: () => props.onMarkerClick(marker),
          }}
        >
          <Popup>
            <TripMapPopup
              title={marker.title}
              subtitle={marker.subtitle}
              date={
                marker.startDate && marker.endDate
                  ? `${marker.startDate} → ${marker.endDate}`
                  : marker.date
              }
              popupData={marker.popupData}
              onOpenItem={props.onOpenItem}
              onGoToDate={props.onGoToDate}
            />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
