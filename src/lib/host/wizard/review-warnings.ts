import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  accommodationAssignments,
  contacts,
  emergencyPhrases,
  participants,
  tripAccommodationStays,
  trips,
} from "@/lib/db/schema";

import type { TripWizardDraft } from "./types";
import { intercityLegPrompt, syncIntercityFromDraft } from "./detect-city-moves";

export type WizardWarning = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  step: number | null;
  field?: string;
};

export async function collectWizardWarnings(
  tripId: string,
  draft: TripWizardDraft,
): Promise<WizardWarning[]> {
  const warnings: WizardWarning[] = [];

  for (const day of draft.dayPlaces) {
    if (!day.primaryCity.trim() && day.dayType !== "buffer") {
      warnings.push({
        id: `no-location-${day.date}`,
        severity: "warning",
        message: `${day.date}: no location set`,
        step: 3,
      });
    }
  }

  const expectedLegs = syncIntercityFromDraft(draft);
  for (const expected of expectedLegs) {
    const hasLeg = draft.intercityLegs.some(
      (l) =>
        (l.legKind ?? "city_change") === (expected.legKind ?? "city_change") &&
        l.intercityFromCity === expected.intercityFromCity &&
        l.intercityToCity === expected.intercityToCity &&
        l.travelDate === expected.travelDate,
    );
    if (!hasLeg) {
      const hint = intercityLegPrompt(expected);
      warnings.push({
        id: `no-transport-${expected.travelDate}-${expected.intercityFromCity}`,
        severity: "warning",
        message:
          hint ??
          `Travel day ${expected.travelDate}: no transport from ${expected.intercityFromCity} to ${expected.intercityToCity}`,
        step: 4,
      });
    }
  }

  for (const leg of [...draft.outboundLegs, ...draft.returnLegs, ...draft.intercityLegs]) {
    if (leg.bookingStatus === "flexible") {
      warnings.push({
        id: `flexible-transport-${leg.id}`,
        severity: "info",
        message: `Transport flexible: ${leg.fromCity} → ${leg.toCity} on ${leg.travelDate}`,
        step: leg.id.startsWith("out") ? 2 : 4,
      });
    } else if (leg.bookingStatus === "placeholder" || leg.bookingStatus === "not_booked") {
      warnings.push({
        id: `not-booked-transport-${leg.id}`,
        severity: "info",
        message: `Transport not booked: ${leg.fromCity} → ${leg.toCity} on ${leg.travelDate}`,
        step: leg.id.startsWith("out") ? 2 : 4,
      });
    }
  }

  const sortedDays = [...draft.dayPlaces]
    .filter((d) => d.primaryCity.trim())
    .sort((a, b) => a.date.localeCompare(b.date));

  for (let i = 0; i < sortedDays.length - 1; i++) {
    const night = sortedDays[i]!;
    const hasStay = draft.accommodationStays.some(
      (s) =>
        s.cityLabel.toLowerCase() === night.primaryCity.toLowerCase() &&
        s.checkInDate <= night.date &&
        s.checkOutDate >= night.date,
    );
    if (!hasStay && night.dayType !== "travel") {
      warnings.push({
        id: `no-accommodation-${night.date}`,
        severity: "warning",
        message: `No accommodation for ${night.primaryCity} on night of ${night.date}`,
        step: 5,
      });
    }
  }

  for (const act of draft.activities) {
    if (!act.isTimeTbc && !act.startTime) {
      warnings.push({
        id: `no-time-${act.id}`,
        severity: "info",
        message: `Activity "${act.title}" has no start time`,
        step: 6,
      });
    }
    if (!act.isLocationTbc && !act.locationName?.trim()) {
      warnings.push({
        id: `no-location-act-${act.id}`,
        severity: "info",
        message: `Activity "${act.title}" has no location`,
        step: 6,
      });
    }
    if (act.bookingStatus === "not_booked") {
      warnings.push({
        id: `not-booked-act-${act.id}`,
        severity: "info",
        message: `Activity "${act.title}" not booked yet`,
        step: 6,
      });
    }
  }

  const multiStays = draft.accommodationStays.filter(
    (s) => s.multipleInCity || s.stayType === "multiple_hotels" || s.stayType === "multiple_hosts",
  );
  if (multiStays.length) {
    const participantCount = await db
      .select({ id: participants.id })
      .from(participants)
      .where(eq(participants.tripId, tripId))
      .then((rows) => rows.length);

    if (participantCount > 0) {
      const stayIds = await db
        .select({ id: tripAccommodationStays.id })
        .from(tripAccommodationStays)
        .where(eq(tripAccommodationStays.tripId, tripId))
        .then((rows) => rows.map((r) => r.id));

      const assignmentCount =
        stayIds.length > 0
          ? await db
              .select({ id: accommodationAssignments.id })
              .from(accommodationAssignments)
              .where(eq(accommodationAssignments.stayId, stayIds[0]!))
              .then((rows) => rows.length)
          : 0;

      if (assignmentCount === 0) {
        warnings.push({
          id: "unassigned-accommodation",
          severity: "warning",
          message: "Multiple accommodations exist but no students are assigned yet",
          step: 5,
        });
      }
    }
  }

  const trip = await db
    .select({ viewerCode: trips.viewerCode })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const emergency = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.tripId, tripId), eq(contacts.isEmergencyLead, true)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const phraseCount = await db
    .select({ id: emergencyPhrases.id })
    .from(emergencyPhrases)
    .where(eq(emergencyPhrases.tripId, tripId))
    .then((rows) => rows.length);

  if (!emergency) {
    warnings.push({
      id: "no-emergency-contact",
      severity: "warning",
      message: "No emergency contact added",
      step: null,
    });
  }

  if (!trip?.viewerCode) {
    warnings.push({
      id: "no-viewer-code",
      severity: "info",
      message: "Viewer code not configured",
      step: null,
    });
  }

  if (phraseCount === 0) {
    warnings.push({
      id: "no-phrases",
      severity: "info",
      message: "No emergency phrases added",
      step: null,
    });
  }

  return warnings;
}
