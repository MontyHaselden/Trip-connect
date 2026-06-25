import type {
  AccommodationStayDraft,
  ActivityDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
  TransportProductDraft,
} from "@/lib/host/wizard/types";
import type { TripLocationBasics } from "@/lib/host/locations/types";

export type SetupGroup = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  sortOrder: number;
  isMain: boolean;
  inheritMode?: "overlay" | "independent" | null;
  personalForParticipantId?: string | null;
};

export type GroupOverlayOpDraft = {
  id: string;
  groupId: string;
  entityType: "itinerary_item" | "transport_leg" | "accommodation_stay" | "trip_day";
  baseEntityId: string;
  op: "hide" | "replace";
  replacementEntityId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type TripSetupState = {
  basics: TripLocationBasics;
  mainGroupId: string;
  groups: SetupGroup[];
  dayPlacesByGroupId: Record<string, DayPlaceDraft[]>;
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  intercityLegs: IntercityLegDraft[];
  accommodationStays: AccommodationStayDraft[];
  activities: ActivityDraft[];
  transportProducts?: TransportProductDraft[];
  overlayOps: GroupOverlayOpDraft[];
};

export type SetupSectionId =
  | "overview"
  | "locations"
  | "accommodation"
  | "transport"
  | "activities"
  | "groups"
  | "participants"
  | "bookings"
  | "finance"
  | "emergency"
  | "photos_viewers"
  | "publish";

export type SetupReadinessStatus =
  | "complete"
  | "flexible"
  | "todo"
  | "decision"
  | "conflict"
  | "idle";

export type SetupSectionReadiness = {
  id: SetupSectionId;
  label: string;
  status: SetupReadinessStatus;
  message?: string;
};
