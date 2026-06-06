import type { ActivityCategory } from "@/types/activity-category";

export const WIZARD_STEPS = [
  { step: 1, label: "Basics" },
  { step: 2, label: "There & Back" },
  { step: 3, label: "Dates & Places" },
  { step: 4, label: "Accommodation" },
  { step: 5, label: "Getting Around" },
  { step: 6, label: "Activities" },
  { step: 7, label: "Meetings" },
  { step: 8, label: "Review" },
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number]["step"];

export const TRANSPORT_TYPES = [
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

export const BOOKING_STATUSES = ["booked", "not_booked", "placeholder"] as const;
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

export type TransportLegDraft = {
  id: string;
  transportType: TransportType;
  bookingStatus: BookingStatus;
  travelDate: string;
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

export type AccommodationStayDraft = {
  id: string;
  cityLabel: string;
  stayType: StayType;
  name: string | null;
  url: string | null;
  address: string | null;
  phone: string | null;
  checkInDate: string;
  checkOutDate: string;
  notes: string | null;
  isHomestayGroup: boolean;
  multipleInCity: boolean;
};

export type IntercityLegDraft = TransportLegDraft & {
  intercityFromCity: string;
  intercityToCity: string;
  travelDate: string;
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
  isLocationTbc: boolean;
  transportNote: string | null;
  leaveByTime: string | null;
  bringNote: string | null;
  description: string | null;
  audienceType: AudienceType;
  audienceId: string | null;
  bookingStatus: BookingStatus;
};

export type ReminderDraft = {
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
  };
}

export function newId(): string {
  return crypto.randomUUID();
}
