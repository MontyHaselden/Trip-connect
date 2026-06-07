import { z } from "zod";

import { ACTIVITY_CATEGORIES } from "@/types/activity-category";

import {
  AUDIENCE_TYPES,
  BOOKING_STATUSES,
  DAY_TYPES,
  MEETING_TYPES,
  STAY_TYPES,
  TRANSPORT_TYPES,
  type TripWizardDraft,
  type WizardStep,
} from "./types";

/** Dates may be empty while the wizard is in progress. */
const DraftDateSchema = z.string();

const TransportLegSchema = z.object({
  id: z.string().uuid(),
  transportType: z.enum(TRANSPORT_TYPES),
  bookingStatus: z.preprocess(
    (val) => (val === "not_booked" ? "placeholder" : val),
    z.enum(BOOKING_STATUSES),
  ),
  travelDate: DraftDateSchema,
  arrivalDate: DraftDateSchema.nullable().default(null),
  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  fromCity: z.string(),
  toCity: z.string(),
  fromStation: z.string().nullable(),
  toStation: z.string().nullable(),
  operator: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  flightNumber: z.string().nullable(),
  notes: z.string().nullable(),
});

const BasicsSchema = z.object({
  name: z.string().max(200),
  schoolName: z.string().max(200),
  startDate: DraftDateSchema,
  endDate: DraftDateSchema,
  destinationCountries: z.array(z.string()),
  destinationLanguages: z.array(z.string()).default([]),
  timezone: z.string().min(1),
  departureCity: z.string(),
  returnCity: z.string(),
});

export const TripWizardDraftSchema = z.object({
  version: z.literal(1),
  basics: BasicsSchema,
  outboundLegs: z.array(TransportLegSchema),
  returnLegs: z.array(TransportLegSchema),
  dayPlaces: z.array(
    z.object({
      date: DraftDateSchema,
      primaryCity: z.string(),
      secondaryCity: z.string().nullable(),
      primaryShare: z.number().min(0).max(1).default(1),
      dayType: z.enum(DAY_TYPES),
      includeBuffer: z.boolean(),
    }),
  ),
  accommodationStays: z.array(
    z.object({
      id: z.string().uuid(),
      cityLabel: z.string(),
      stayType: z.enum(STAY_TYPES),
      name: z.string().nullable(),
      url: z.string().nullable(),
      address: z.string().nullable(),
      phone: z.string().nullable(),
      checkInDate: DraftDateSchema,
      checkOutDate: DraftDateSchema,
      notes: z.string().nullable(),
      isHomestayGroup: z.boolean(),
      multipleInCity: z.boolean(),
    }),
  ),
  intercityLegs: z.array(
    TransportLegSchema.extend({
      intercityFromCity: z.string(),
      intercityToCity: z.string(),
      legKind: z.enum(["city_change", "airport_arrival", "airport_departure"]).optional(),
      anchorLegId: z.string().uuid().nullable().optional(),
    }),
  ),
  activities: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      date: DraftDateSchema,
      endDate: DraftDateSchema.nullable(),
      startTime: z.string().nullable(),
      endTime: z.string().nullable(),
      isTimeTbc: z.boolean(),
      category: z.enum(ACTIVITY_CATEGORIES),
      locationName: z.string().nullable(),
      address: z.string().nullable(),
      isLocationTbc: z.boolean(),
      transportNote: z.string().nullable(),
      leaveByTime: z.string().nullable(),
      bringNote: z.string().nullable(),
      description: z.string().nullable(),
      audienceType: z.enum(AUDIENCE_TYPES),
      audienceId: z.string().uuid().nullable(),
      bookingStatus: z.preprocess(
        (val) => (val === "not_booked" ? "placeholder" : val),
        z.enum(BOOKING_STATUSES),
      ),
    }),
  ),
  reminders: z.array(
    z.object({
      id: z.string().uuid(),
      date: DraftDateSchema,
      title: z.string(),
      reminderTime: z.string().nullable(),
      note: z.string().nullable(),
      audienceType: z.enum(AUDIENCE_TYPES),
      audienceId: z.string().uuid().nullable(),
    }),
  ),
  meetings: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      description: z.string().nullable(),
      date: DraftDateSchema,
      time: z.string().nullable(),
      location: z.string().nullable(),
      meetingType: z.enum(MEETING_TYPES),
      notes: z.string().nullable(),
      audienceType: z.enum(AUDIENCE_TYPES),
      audienceId: z.string().uuid().nullable(),
    }),
  ),
  shellCommitted: z.boolean(),
  wizardFinished: z.boolean().default(false),
  datesPlacesConfirmed: z.boolean().default(false),
});

function normalizeTransportLegs(legs: Array<Record<string, unknown>> | undefined): void {
  if (!legs) return;
  for (const leg of legs) {
    if (!("arrivalDate" in leg)) {
      leg.arrivalDate = null;
    }
  }
}

export function parseWizardDraft(json: unknown): TripWizardDraft {
  const raw = json as {
    dayPlaces?: Array<Record<string, unknown>>;
    outboundLegs?: Array<Record<string, unknown>>;
    returnLegs?: Array<Record<string, unknown>>;
    intercityLegs?: Array<Record<string, unknown>>;
  } | null;
  if (raw) {
    normalizeTransportLegs(raw.outboundLegs);
    normalizeTransportLegs(raw.returnLegs);
    normalizeTransportLegs(raw.intercityLegs);
  }
  if (raw?.dayPlaces) {
    for (const day of raw.dayPlaces) {
      if (typeof day.primaryShare !== "number") {
        day.primaryShare = day.secondaryCity ? 0.5 : 1;
      }
    }
  }
  if (raw && typeof raw === "object") {
    if (typeof (raw as { wizardFinished?: unknown }).wizardFinished !== "boolean") {
      (raw as { wizardFinished: boolean }).wizardFinished = false;
    }
    if (typeof (raw as { datesPlacesConfirmed?: unknown }).datesPlacesConfirmed !== "boolean") {
      (raw as { datesPlacesConfirmed: boolean }).datesPlacesConfirmed = false;
    }
  }
  return TripWizardDraftSchema.parse(json);
}

export function validateStep(step: WizardStep, draft: TripWizardDraft): string[] {
  const errors: string[] = [];
  if (step >= 1) {
    if (draft.basics.name.trim().length < 2) errors.push("Trip name is required.");
  }
  if (step >= 2) {
    if (!draft.basics.startDate) errors.push("Add your outbound flight departure date.");
    if (!draft.basics.endDate) errors.push("Add your return flight departure date.");
    if (draft.basics.startDate && draft.basics.endDate && draft.basics.startDate > draft.basics.endDate) {
      errors.push("Return flight must be on or after your outbound flight.");
    }
  }
  return errors;
}
