import type { ActivityCategory } from "@/types/activity-category";

export const WIZARD_STEPS = [
  { step: 1, label: "Basics" },
  { step: 2, label: "There & Back" },
  { step: 3, label: "Dates & Places" },
  { step: 4, label: "Between Cities" },
  { step: 5, label: "Accommodation" },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]["step"];

export const WIZARD_LAST_STEP: WizardStep = 5;

export const TRANSPORT_TYPES = [
  "unsure",
  "plane",
  "train",
  "bus",
  "coach",
  "ferry",
  "car",
  "taxi",
  "walking",
  "other",
] as const;

export type TransportType = (typeof TRANSPORT_TYPES)[number];

/** Transport legs — placeholder = not booked yet; flexible = calendar placeholder block only. */
export const BOOKING_STATUSES = ["booked", "placeholder", "flexible", "not_booked"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const DAY_TYPES = [
  "trip",
  "travel",
  "meeting",
  "free",
  "buffer",
  "return",
] as const;
export type DayType = (typeof DAY_TYPES)[number];

export const STAY_TYPES = [
  "hotel",
  "hostel",
  "homestay",
  "campground",
  "multiple_hosts",
  "multiple_hotels",
  "not_booked",
  "other",
] as const;
export type StayType = (typeof STAY_TYPES)[number];

export const MEETING_TYPES = [
  "student_meeting",
  "parent_meeting",
  "staff_meeting",
  "final_briefing",
  "other",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const AUDIENCE_TYPES = ["everyone", "group", "room", "participant"] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

import type { VisibilityMode, VisibilityTarget } from "@/lib/visibility/types";

export type EntityVisibilityDraft = {
  visibilityMode?: VisibilityMode;
  targets?: VisibilityTarget[];
};

export type LayerEntityDraft = {
  originGroupId?: string | null;
  sourceEntityId?: string | null;
};

export const TRANSPORT_PRODUCT_KINDS = [
  "flight_package",
  "train_pass",
  "ic_card",
  "bus_pass",
] as const;
export type TransportProductKind = (typeof TRANSPORT_PRODUCT_KINDS)[number];

export type TransportProductDraft = {
  id: string;
  kind: TransportProductKind;
  name: string;
  participantIds: string[];
  notes?: string | null;
};

export type TransportLegBillingMode = "single" | "product";

export type TransportLegDraft = EntityVisibilityDraft & LayerEntityDraft & {
  id: string;
  transportType: TransportType;
  bookingStatus: BookingStatus;
  /** Departure date (ISO). */
  travelDate: string;
  /** Arrival date (ISO) when different from departure — e.g. overnight flights. */
  arrivalDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  fromCity: string;
  toCity: string;
  fromStation: string | null;
  toStation: string | null;
  operator: string | null;
  referenceNumber: string | null;
  flightNumber: string | null;
  notes: string | null;
  /** When true, leg is kept in transport data but does not paint the group calendar. */
  surfaceOnly?: boolean;
  billingMode?: TransportLegBillingMode;
  transportProductId?: string | null;
};

export type DayPlaceDraft = {
  date: string;
  primaryCity: string;
  secondaryCity: string | null;
  /** Fraction of the day spent in primaryCity (0–1). Secondary gets the rest. */
  primaryShare: number;
  dayType: DayType;
  includeBuffer: boolean;
};

export type AccommodationStayDraft = EntityVisibilityDraft & LayerEntityDraft & {
  id: string;
  cityLabel: string;
  stayType: StayType;
  name: string | null;
  url: string | null;
  address: string | null;
  phone: string | null;
  googlePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  checkInDate: string;
  checkOutDate: string;
  notes: string | null;
  isHomestayGroup: boolean;
  multipleInCity: boolean;
};

export const INTERCITY_LEG_KINDS = [
  "city_change",
  "airport_arrival",
  "airport_departure",
  "connection",
] as const;
export type IntercityLegKind = (typeof INTERCITY_LEG_KINDS)[number];

export type IntercityLegDraft = TransportLegDraft & {
  intercityFromCity: string;
  intercityToCity: string;
  travelDate: string;
  legKind?: IntercityLegKind;
  anchorLegId?: string | null;
};

export type ActivityDraft = {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isTimeTbc: boolean;
  category: ActivityCategory;
  locationName: string | null;
  address: string | null;
  googlePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isLocationTbc: boolean;
  transportNote: string | null;
  leaveByTime: string | null;
  bringNote: string | null;
  description: string | null;
  audienceType: AudienceType;
  audienceId: string | null;
  originGroupId?: string | null;
  bookingStatus: BookingStatus;
};

export type ReminderDraft = EntityVisibilityDraft & {
  id: string;
  date: string;
  title: string;
  reminderTime: string | null;
  note: string | null;
  audienceType: AudienceType;
  audienceId: string | null;
};

export type MeetingDraft = {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string | null;
  location: string | null;
  meetingType: MeetingType;
  notes: string | null;
  audienceType: AudienceType;
  audienceId: string | null;
};

export type WizardBasics = {
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  destinationCountries: string[];
  /** @deprecated Auto-managed; kept for draft compatibility */
  destinationLanguages: string[];
  /** IANA zone — inferred automatically from places */
  timezone: string;
  departureCity: string;
  returnCity: string;
  /** Home airport — outbound legs default to this instead of the city label. */
  defaultDepartureAirport?: string;
};

export type TripWizardDraft = {
  version: 1;
  basics: WizardBasics;
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  dayPlaces: DayPlaceDraft[];
  accommodationStays: AccommodationStayDraft[];
  intercityLegs: IntercityLegDraft[];
  activities: ActivityDraft[];
  reminders: ReminderDraft[];
  meetings: MeetingDraft[];
  shellCommitted: boolean;
  wizardFinished: boolean;
  /** Set when the host confirms the dates & places plan — unlocks Between Cities. */
  datesPlacesConfirmed: boolean;
};

export function emptyWizardDraft(name: string): TripWizardDraft {
  return {
    version: 1,
    basics: {
      name,
      schoolName: "School trip",
      startDate: "",
      endDate: "",
      destinationCountries: [],
      destinationLanguages: [],
      timezone: "Pacific/Auckland",
      departureCity: "",
      returnCity: "",
    },
    outboundLegs: [],
    returnLegs: [],
    dayPlaces: [],
    accommodationStays: [],
    intercityLegs: [],
    activities: [],
    reminders: [],
    meetings: [],
    shellCommitted: false,
    wizardFinished: false,
    datesPlacesConfirmed: false,
  };
}

export function newId(): string {
  return crypto.randomUUID();
}
