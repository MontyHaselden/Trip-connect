import type { ActivityCategory, DayWeatherSnapshot } from "./activity-category";
import type { VisibilityMode } from "@/lib/visibility/types";

export type PublishedVisibilityMode = VisibilityMode;

export type PublishedVisibilityTarget = {
  entityType:
    | "itinerary_item"
    | "transport_leg"
    | "accommodation_stay"
    | "day_reminder"
    | "prep_item"
    | "contact"
    | "room";
  entityId: string;
  targetType: "group" | "participant" | "room";
  targetId: string;
};

export type PublishedAccommodationAssignment = {
  id: string;
  stayId: string;
  participantId: string | null;
  groupId: string | null;
  roomId: string | null;
  startDate: string;
  endDate: string;
  stayName: string | null;
  stayAddress: string | null;
  stayPhone: string | null;
  stayType: string;
  cityLabel: string;
};

export type PublishedGroupType =
  | "activity"
  | "bus"
  | "week"
  | "route"
  | "split_travel"
  | "accommodation"
  | "staff_helper"
  | "other";

export type PublishedGroupDayPlace = {
  id: string;
  groupId: string;
  date: string;
  primaryCity: string;
  secondaryCity: string | null;
  primaryShare: number;
  dayType: string | null;
  calendarLabel: string | null;
  weatherLocationQuery: string | null;
};

export type PublishedGroupOverlayOp = {
  id: string;
  groupId: string;
  entityType: "itinerary_item" | "transport_leg" | "accommodation_stay" | "trip_day";
  baseEntityId: string;
  op: "hide" | "replace";
  replacementEntityId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type LayerFields = {
  originGroupId: string | null;
  sourceEntityId: string | null;
};

export type PublishedTransportLeg = LayerFields & {
  id: string;
  legKind: string;
  transportType: string;
  travelDate: string;
  departureTime: string | null;
  arrivalTime: string | null;
  fromCity: string | null;
  toCity: string | null;
  fromStation: string | null;
  toStation: string | null;
  operator: string | null;
  referenceNumber: string | null;
  flightNumber: string | null;
  notes: string | null;
  sortOrder: number;
  bookingStatus?: string | null;
  visibilityMode: PublishedVisibilityMode;
  audienceType: "everyone" | "group" | "room" | "participant";
  audienceId: string | null;
};

export type VisibilityFields = {
  visibilityMode: PublishedVisibilityMode;
  audienceType: "everyone" | "group" | "room" | "participant";
  audienceId: string | null;
};

export type PublishedTripSnapshotV1 = {
  version: number;
  publishedAt: string; // ISO
  trip: {
    id: string;
    name: string;
    schoolName: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    destinationCountry: string | null;
    destinationLanguage: string | null;
    timezone: string;
    publishedVersion: number;
    localEmergencyNumber?: string | null;
    schoolEmergencyPhone?: string | null;
  };
  days: Array<{
    id: string;
    date: string; // YYYY-MM-DD
    cityLabel: string;
    calendarLabel: string | null;
    summary: string | null;
    sortOrder: number;
    dayType?: string | null;
    secondaryCityLabel?: string | null;
    isBufferDay?: boolean;
    weather?: DayWeatherSnapshot | null;
  }>;
  accommodationStays?: Array<
    LayerFields & {
      id: string;
      cityLabel: string;
      stayType: string;
      name: string | null;
      address: string | null;
      phone?: string | null;
      checkInDate: string;
      checkOutDate: string;
      visibilityMode: PublishedVisibilityMode;
      audienceType: "everyone" | "group" | "room" | "participant";
      audienceId: string | null;
    }
  >;
  groupDayPlaces?: PublishedGroupDayPlace[];
  groupOverlayOps?: PublishedGroupOverlayOp[];
  accommodationAssignments?: PublishedAccommodationAssignment[];
  transportLegs?: PublishedTransportLeg[];
  visibilityTargets?: PublishedVisibilityTarget[];
  dayReminders?: Array<{
    id: string;
    tripDayId: string;
    title: string;
    reminderTime: string | null;
    note: string | null;
    sortOrder: number;
    visibilityMode: PublishedVisibilityMode;
    audienceType: "everyone" | "group" | "room" | "participant";
    audienceId: string | null;
  }>;
  itineraryItems: Array<
    LayerFields & {
      id: string;
      tripDayId: string;
      startTime: string; // HH:MM:SS
      endTime: string | null;
      title: string;
      locationName: string | null;
      address: string | null;
      mapQuery: string | null;
      leaveByTime: string | null;
      transportNote: string | null;
      bringNote: string | null;
      hostNote: string | null;
      audienceType: "everyone" | "group" | "room" | "participant";
      audienceId: string | null;
      visibilityMode: PublishedVisibilityMode;
      category: ActivityCategory | null;
      sortOrder: number;
      bookingStatus?: string | null;
    }
  >;
  tomorrowPrepItems: Array<{
    id: string;
    tripDayId: string;
    text: string;
    sortOrder: number;
    visibilityMode: PublishedVisibilityMode;
    audienceType: "everyone" | "group" | "room" | "participant";
    audienceId: string | null;
  }>;
  contacts: Array<{
    id: string;
    name: string;
    role: string;
    phoneNumber: string;
    visibility: "students" | "hosts_only";
    sortOrder: number;
    isEmergencyLead: boolean;
    visibilityMode: PublishedVisibilityMode;
    audienceType: "everyone" | "group" | "room" | "participant";
    audienceId: string | null;
  }>;
  participants: Array<{
    id: string;
    fullName: string;
    phoneNumberE164: string;
    role: "student" | "helper" | "teacher" | "host";
  }>;
  groups: Array<{
    id: string;
    name: string;
    type: PublishedGroupType;
    description: string | null;
    sortOrder: number;
    isMain: boolean;
  }>;
  participantGroups: Array<{
    participantId: string;
    groupId: string;
    effectiveFrom?: string | null;
    effectiveTo?: string | null;
  }>;
  rooms: Array<{
    id: string;
    roomName: string;
    hotelName: string | null;
    hotelAddress: string | null;
    nearestStation: string | null;
    hotelPhone?: string | null;
    nearestStationNotes?: string | null;
    nearestBusStopName?: string | null;
    routeNotesToAccommodation?: string | null;
    staticMapUrl?: string | null;
    mapsUrl?: string | null;
    notes: string | null;
    sortOrder: number;
    visibilityMode: PublishedVisibilityMode;
    audienceType: "everyone" | "group" | "room" | "participant";
    audienceId: string | null;
  }>;
  participantRooms: Array<{ participantId: string; roomId: string }>;
  phraseCategories: Array<{ id: string; name: string; sortOrder: number }>;
  phrases: Array<{
    id: string;
    categoryId: string;
    englishText: string;
    translatedText: string;
    pronunciation: string | null;
    notes: string | null;
    source: "default" | "ai" | "host";
    sortOrder: number;
  }>;
  photos?: Array<{
    id: string;
    tripDayId: string;
    participantId: string;
    type: "selfie" | "place";
    imageUrl: string;
    thumbnailUrl: string | null;
    caption: string | null;
    status: "visible" | "hidden" | "deleted";
  }>;
  viewerSettings?: {
    galleryEnabled: boolean;
    roomDetailsEnabled: boolean;
  };
};

export type ResolvedAccommodation = {
  source: "assignment" | "everyone_stay" | "room";
  name: string | null;
  address: string | null;
  phone: string | null;
  stayType: string | null;
  cityLabel: string | null;
  hotelPhone?: string | null;
  nearestStation?: string | null;
  nearestStationNotes?: string | null;
  nearestBusStopName?: string | null;
  routeNotesToAccommodation?: string | null;
  staticMapUrl?: string | null;
  mapsUrl?: string | null;
};
