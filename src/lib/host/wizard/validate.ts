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

const TransportLegSchema = z.object({
  id: z.string().uuid(),
  transportType: z.enum(TRANSPORT_TYPES),
  bookingStatus: z.enum(BOOKING_STATUSES),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
  name: z.string().trim().min(2).max(200),
  schoolName: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  destinationCountries: z.array(z.string()),
  destinationLanguages: z.array(z.string()),
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
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      primaryCity: z.string(),
      secondaryCity: z.string().nullable(),
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
      checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notes: z.string().nullable(),
      isHomestayGroup: z.boolean(),
      multipleInCity: z.boolean(),
    }),
  ),
  intercityLegs: z.array(
    TransportLegSchema.extend({
      intercityFromCity: z.string(),
      intercityToCity: z.string(),
    }),
  ),
  activities: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
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
      bookingStatus: z.enum(BOOKING_STATUSES),
    }),
  ),
  reminders: z.array(
    z.object({
      id: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      title: z.string().min(1),
      reminderTime: z.string().nullable(),
      note: z.string().nullable(),
      audienceType: z.enum(AUDIENCE_TYPES),
      audienceId: z.string().uuid().nullable(),
    }),
  ),
  meetings: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().nullable(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().nullable(),
      location: z.string().nullable(),
      meetingType: z.enum(MEETING_TYPES),
      notes: z.string().nullable(),
      audienceType: z.enum(AUDIENCE_TYPES),
      audienceId: z.string().uuid().nullable(),
    }),
  ),
  shellCommitted: z.boolean(),
});

export function parseWizardDraft(json: unknown): TripWizardDraft {
  return TripWizardDraftSchema.parse(json);
}

export function validateStep(step: WizardStep, draft: TripWizardDraft): string[] {
  const errors: string[] = [];
  if (step >= 1) {
    if (draft.basics.name.trim().length < 2) errors.push("Trip name is required.");
    if (!draft.basics.startDate) errors.push("Start date is required.");
    if (!draft.basics.endDate) errors.push("End date is required.");
    if (draft.basics.startDate && draft.basics.endDate && draft.basics.startDate > draft.basics.endDate) {
      errors.push("End date must be on or after start date.");
    }
  }
  return errors;
}
