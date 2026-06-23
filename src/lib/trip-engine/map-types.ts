export type TripMapEntityType =
  | "location"
  | "accommodation"
  | "transport"
  | "activity"
  | "day_place";

export type TripMapCategory = "accommodation" | "transport" | "activities" | "locations";

export type TripMapMarkerPopupData = {
  entityType: TripMapEntityType;
  entityId: string;
  sectionId: "accommodation" | "transport" | "activities" | "locations";
  linkedCalendarDay: string;
  bookingStatus?: string | null;
  bookingReference?: string | null;
  costNote?: string | null;
};

export type TripMapMarker = {
  id: string;
  entityType: TripMapEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  date: string;
  startDate?: string;
  endDate?: string;
  groupId: string;
  category: TripMapCategory;
  lat: number;
  lng: number;
  city: string;
  country?: string;
  linkedCalendarDay: string;
  color: string;
  status?: string;
  popupData: TripMapMarkerPopupData;
};

export type TripMapRouteMode =
  | "flight"
  | "train"
  | "bus"
  | "ferry"
  | "walk"
  | "car"
  | "other";

export type TripMapRouteLine = {
  id: string;
  entityType: "transport";
  entityId: string;
  title: string;
  fromTitle: string;
  toTitle: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  date: string;
  groupId: string;
  mode: TripMapRouteMode;
  status?: string;
  bookingReference?: string | null;
  endpointSource: "accommodation_anchor" | "explicit";
  popupData: TripMapMarkerPopupData;
};

export type NeedsCoordinatesItem = {
  id: string;
  entityType: TripMapEntityType;
  entityId: string;
  title: string;
  subtitle: string;
  date: string;
  groupId: string;
  category: TripMapCategory;
  city: string;
  sectionId: TripMapMarkerPopupData["sectionId"];
  linkedCalendarDay: string;
};

export type TripMapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type TripMapFilters = {
  groupId: string;
  categories?: Set<TripMapCategory>;
};

export type TripMapProjection = {
  markers: TripMapMarker[];
  routeLines: TripMapRouteLine[];
  bounds: TripMapBounds | null;
  missingCoordinates: NeedsCoordinatesItem[];
  warnings: string[];
};
