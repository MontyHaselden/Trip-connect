import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  ActivityDraft,
  IntercityLegDraft,
  TransportLegDraft,
  TransportType,
} from "@/lib/host/wizard/types";

import type {
  NeedsCoordinatesItem,
  TripMapBounds,
  TripMapCategory,
  TripMapFilters,
  TripMapMarker,
  TripMapProjection,
  TripMapRouteLine,
  TripMapRouteMode,
} from "./map-types";
import {
  activitiesForGroup,
  calendarContentScopeForGroup,
  dayPlacesForGroup,
} from "./selectors";
import type { TripEntityGraph } from "./types";

export const MAP_MARKER_COLORS = {
  accommodation: "#7c3aed",
  transport: "#2563eb",
  activities: "#16a34a",
  locations: "#dc2626",
} as const;

type CityAnchor = { lat: number; lng: number; city: string; stayId: string };

function hasValidCoords(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

function transportMode(type: TransportType): TripMapRouteMode {
  switch (type) {
    case "plane":
      return "flight";
    case "train":
      return "train";
    case "bus":
    case "coach":
      return "bus";
    case "ferry":
      return "ferry";
    case "walking":
      return "walk";
    case "car":
    case "taxi":
      return "car";
    default:
      return "other";
  }
}

function categoryEnabled(
  filters: TripMapFilters,
  category: TripMapCategory,
): boolean {
  if (!filters.categories?.size) return true;
  return filters.categories.has(category);
}

function buildCityAnchorIndex(stays: AccommodationStayDraft[]): Map<string, CityAnchor> {
  const index = new Map<string, CityAnchor>();
  for (const stay of stays) {
    if (!stay.name?.trim()) continue;
    if (!hasValidCoords(stay.latitude, stay.longitude)) continue;
    const city = stay.cityLabel.trim();
    if (!city) continue;
    const key = city.toLowerCase();
    if (!index.has(key)) {
      index.set(key, {
        lat: stay.latitude!,
        lng: stay.longitude!,
        city,
        stayId: stay.id,
      });
    }
  }
  return index;
}

function resolveCityAnchor(
  city: string,
  index: Map<string, CityAnchor>,
): CityAnchor | null {
  const trimmed = city.trim();
  if (!trimmed) return null;
  const direct = index.get(trimmed.toLowerCase());
  if (direct) return direct;
  for (const [key, anchor] of index) {
    if (locationsMatch(key, trimmed) || locationsMatch(anchor.city, trimmed)) {
      return anchor;
    }
  }
  return null;
}

function computeBounds(
  markers: TripMapMarker[],
  routes: TripMapRouteLine[],
): TripMapBounds | null {
  const points: Array<{ lat: number; lng: number }> = [];
  for (const m of markers) points.push({ lat: m.lat, lng: m.lng });
  for (const r of routes) {
    points.push({ lat: r.fromLat, lng: r.fromLng }, { lat: r.toLat, lng: r.toLng });
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
  if (south === north && west === east) {
    const pad = 0.05;
    return { south: south - pad, north: north + pad, west: west - pad, east: east + pad };
  }
  return { south, west, north, east };
}

function projectAccommodationMarkers(
  stays: AccommodationStayDraft[],
  groupId: string,
  markers: TripMapMarker[],
  missing: NeedsCoordinatesItem[],
  seenMissing: Set<string>,
): void {
  for (const stay of stays) {
    if (!stay.name?.trim()) continue;
    const city = stay.cityLabel.trim() || stay.name;
    if (hasValidCoords(stay.latitude, stay.longitude)) {
      markers.push({
        id: `accommodation-${stay.id}`,
        entityType: "accommodation",
        entityId: stay.id,
        title: stay.name,
        subtitle: city,
        date: stay.checkInDate,
        startDate: stay.checkInDate,
        endDate: stay.checkOutDate,
        groupId: stay.originGroupId ?? groupId,
        category: "accommodation",
        lat: stay.latitude!,
        lng: stay.longitude!,
        city,
        linkedCalendarDay: stay.checkInDate,
        color: MAP_MARKER_COLORS.accommodation,
        status: stay.stayType,
        popupData: {
          entityType: "accommodation",
          entityId: stay.id,
          sectionId: "accommodation",
          linkedCalendarDay: stay.checkInDate,
        },
      });
    } else {
      const id = `missing-accommodation-${stay.id}`;
      if (!seenMissing.has(id)) {
        seenMissing.add(id);
        missing.push({
          id,
          entityType: "accommodation",
          entityId: stay.id,
          title: stay.name,
          subtitle: `${city} · ${stay.checkInDate} → ${stay.checkOutDate}`,
          date: stay.checkInDate,
          groupId: stay.originGroupId ?? groupId,
          category: "accommodation",
          city,
          sectionId: "accommodation",
          linkedCalendarDay: stay.checkInDate,
        });
      }
    }
  }
}

function projectActivityMarkers(
  activities: ActivityDraft[],
  groupId: string,
  markers: TripMapMarker[],
  missing: NeedsCoordinatesItem[],
  seenMissing: Set<string>,
): void {
  for (const activity of activities) {
    if (!activity.title.trim()) continue;
    const city =
      activity.locationName?.trim() ||
      activity.address?.trim()?.split(",")[0]?.trim() ||
      "";
    if (hasValidCoords(activity.latitude, activity.longitude)) {
      markers.push({
        id: `activity-${activity.id}`,
        entityType: "activity",
        entityId: activity.id,
        title: activity.title,
        subtitle: city || activity.date,
        date: activity.date,
        groupId: activity.originGroupId ?? groupId,
        category: "activities",
        lat: activity.latitude!,
        lng: activity.longitude!,
        city: city || "—",
        linkedCalendarDay: activity.date,
        color: MAP_MARKER_COLORS.activities,
        status: activity.bookingStatus,
        popupData: {
          entityType: "activity",
          entityId: activity.id,
          sectionId: "activities",
          linkedCalendarDay: activity.date,
          bookingStatus: activity.bookingStatus,
        },
      });
      continue;
    }

    const id = `missing-activity-${activity.id}`;
    if (seenMissing.has(id)) continue;
    seenMissing.add(id);
    missing.push({
      id,
      entityType: "activity",
      entityId: activity.id,
      title: activity.title,
      subtitle: city || activity.date,
      date: activity.date,
      groupId: activity.originGroupId ?? groupId,
      category: "activities",
      city: city || "—",
      sectionId: "activities",
      linkedCalendarDay: activity.date,
    });
  }
}

function projectTransportLeg(
  leg: TransportLegDraft | IntercityLegDraft,
  groupId: string,
  anchorIndex: Map<string, CityAnchor>,
  routes: TripMapRouteLine[],
  missing: NeedsCoordinatesItem[],
  seenMissing: Set<string>,
  markers: TripMapMarker[],
  markerIds: Set<string>,
): void {
  if (leg.surfaceOnly) return;

  const from =
    "intercityFromCity" in leg && leg.intercityFromCity.trim()
      ? leg.intercityFromCity.trim()
      : leg.fromCity.trim();
  const to =
    "intercityToCity" in leg && leg.intercityToCity.trim()
      ? leg.intercityToCity.trim()
      : leg.toCity.trim();
  if (!from || !to) return;

  const fromAnchor = resolveCityAnchor(from, anchorIndex);
  const toAnchor = resolveCityAnchor(to, anchorIndex);

  if (fromAnchor && toAnchor) {
    const routeId = `route-${leg.id}`;
    routes.push({
      id: routeId,
      entityType: "transport",
      entityId: leg.id,
      title: `${from} → ${to}`,
      fromTitle: from,
      toTitle: to,
      fromLat: fromAnchor.lat,
      fromLng: fromAnchor.lng,
      toLat: toAnchor.lat,
      toLng: toAnchor.lng,
      date: leg.travelDate,
      groupId: leg.originGroupId ?? groupId,
      mode: transportMode(leg.transportType),
      status: leg.bookingStatus,
      bookingReference: leg.referenceNumber,
      endpointSource: "accommodation_anchor",
      popupData: {
        entityType: "transport",
        entityId: leg.id,
        sectionId: "transport",
        linkedCalendarDay: leg.travelDate,
        bookingStatus: leg.bookingStatus,
        bookingReference: leg.referenceNumber,
      },
    });

    for (const [side, anchor, title] of [
      ["from", fromAnchor, from] as const,
      ["to", toAnchor, to] as const,
    ]) {
      const markerId = `transport-${leg.id}-${side}`;
      if (markerIds.has(markerId)) continue;
      markerIds.add(markerId);
      markers.push({
        id: markerId,
        entityType: "transport",
        entityId: leg.id,
        title,
        subtitle: `Transport ${side}`,
        date: leg.travelDate,
        groupId: leg.originGroupId ?? groupId,
        category: "transport",
        lat: anchor.lat,
        lng: anchor.lng,
        city: title,
        linkedCalendarDay: leg.travelDate,
        color: MAP_MARKER_COLORS.transport,
        status: leg.bookingStatus,
        popupData: {
          entityType: "transport",
          entityId: leg.id,
          sectionId: "transport",
          linkedCalendarDay: leg.travelDate,
          bookingStatus: leg.bookingStatus,
          bookingReference: leg.referenceNumber,
        },
      });
    }
  } else {
    const id = `missing-transport-${leg.id}`;
    if (!seenMissing.has(id)) {
      seenMissing.add(id);
      missing.push({
        id,
        entityType: "transport",
        entityId: leg.id,
        title: `${from} → ${to}`,
        subtitle: leg.travelDate,
        date: leg.travelDate,
        groupId: leg.originGroupId ?? groupId,
        category: "transport",
        city: !fromAnchor ? from : to,
        sectionId: "transport",
        linkedCalendarDay: leg.travelDate,
      });
    }
  }
}

/** Read-only map projection from the trip graph. */
export function projectTripMap(
  graph: TripEntityGraph,
  filters: TripMapFilters,
): TripMapProjection {
  const groupId = filters.groupId;
  const scope = calendarContentScopeForGroup(graph, groupId);
  const activities = activitiesForGroup(graph, groupId);

  const allMarkers: TripMapMarker[] = [];
  const allRoutes: TripMapRouteLine[] = [];
  const missing: NeedsCoordinatesItem[] = [];
  const seenMissing = new Set<string>();
  const transportMarkerIds = new Set<string>();

  const anchorIndex = buildCityAnchorIndex(scope.stays);

  if (categoryEnabled(filters, "accommodation")) {
    projectAccommodationMarkers(scope.stays, groupId, allMarkers, missing, seenMissing);
  } else {
    for (const stay of scope.stays) {
      if (!stay.name?.trim()) continue;
      const id = `missing-accommodation-${stay.id}`;
      if (!seenMissing.has(id)) {
        seenMissing.add(id);
        missing.push({
          id,
          entityType: "accommodation",
          entityId: stay.id,
          title: stay.name,
          subtitle: stay.cityLabel,
          date: stay.checkInDate,
          groupId: stay.originGroupId ?? groupId,
          category: "accommodation",
          city: stay.cityLabel,
          sectionId: "accommodation",
          linkedCalendarDay: stay.checkInDate,
        });
      }
    }
  }

  if (categoryEnabled(filters, "activities")) {
    projectActivityMarkers(activities, groupId, allMarkers, missing, seenMissing);
  }

  if (categoryEnabled(filters, "transport")) {
    const allLegs = [
      ...scope.outboundLegs,
      ...scope.returnLegs,
      ...scope.intercityLegs,
    ];
    for (const leg of allLegs) {
      projectTransportLeg(
        leg,
        groupId,
        anchorIndex,
        allRoutes,
        missing,
        seenMissing,
        allMarkers,
        transportMarkerIds,
      );
    }
  }

  const markers = allMarkers;
  const routeLines = allRoutes;
  const bounds = computeBounds(markers, routeLines);
  const warnings: string[] = [];
  if (missing.length) {
    warnings.push(
      `${missing.length} location${missing.length === 1 ? "" : "s"} missing map coordinates`,
    );
  }

  return { markers, routeLines, bounds, missingCoordinates: missing, warnings };
}
