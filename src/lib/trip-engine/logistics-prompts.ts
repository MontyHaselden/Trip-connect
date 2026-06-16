import type { TripEntityGraph } from "./types";

export type LogisticsPrompt = {
  id: string;
  severity: "warning" | "info";
  message: string;
  section: string;
  entityType?: string;
  entityId?: string;
};

/** Rule-based overview prompts: invoice gaps, missing intercity, unpainted days. */
export function computeLogisticsPrompts(graph: TripEntityGraph): LogisticsPrompt[] {
  const prompts: LogisticsPrompt[] = [];

  for (const stay of graph.accommodationStays) {
    if (!stay.name?.trim()) continue;
    const booking = graph.bookingsSummary.find(
      (b) => b.entityType === "accommodation_stay" && b.entityId === stay.id,
    );
    const isBooked = booking?.bookingStatus === "booked";
    if (isBooked && !booking?.bookingReference?.trim()) {
      prompts.push({
        id: `invoice-stay-${stay.id}`,
        severity: "warning",
        message: `${stay.name} is marked booked but has no booking reference on file.`,
        section: "bookings",
        entityType: "accommodation_stay",
        entityId: stay.id,
      });
    }
  }

  for (const leg of [...graph.outboundLegs, ...graph.returnLegs, ...graph.intercityLegs]) {
    const booking = graph.bookingsSummary.find(
      (b) => b.entityType === "transport_leg" && b.entityId === leg.id,
    );
    if (leg.bookingStatus === "booked" && !booking?.bookingReference?.trim()) {
      const label =
        "fromCity" in leg && leg.fromCity
          ? `${leg.fromCity} → ${"toCity" in leg ? leg.toCity : "?"}`
          : "Transport leg";
      prompts.push({
        id: `invoice-leg-${leg.id}`,
        severity: "warning",
        message: `${label} on ${leg.travelDate} is booked but has no invoice/reference on file.`,
        section: "bookings",
        entityType: "transport_leg",
        entityId: leg.id,
      });
    }
  }

  const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
  for (const day of mainDays) {
    if (!day.primaryCity.trim() && !day.secondaryCity?.trim()) {
      const hasStay = graph.accommodationStays.some(
        (s) => s.checkInDate <= day.date && s.checkOutDate > day.date,
      );
      const hasActivity = graph.activities.some((a) => a.date === day.date);
      if (hasStay || hasActivity) {
        prompts.push({
          id: `unpainted-${day.date}`,
          severity: "info",
          message: `${day.date} has stays or activities but no painted location.`,
          section: "locations",
        });
      }
    }
  }

  const paintedCities = new Set(
    mainDays
      .filter((d) => d.primaryCity.trim())
      .map((d) => d.primaryCity.trim().toLowerCase()),
  );
  for (let i = 0; i < graph.intercityLegs.length - 1; i++) {
    const leg = graph.intercityLegs[i];
    const nextStay = graph.accommodationStays.find(
      (s) => s.checkInDate > leg.travelDate,
    );
    if (nextStay && leg.intercityToCity && nextStay.cityLabel) {
      const toCity = leg.intercityToCity.trim().toLowerCase();
      const stayCity = nextStay.cityLabel.trim().toLowerCase();
      if (toCity !== stayCity && !paintedCities.has(stayCity)) {
        prompts.push({
          id: `intercity-gap-${leg.id}`,
          severity: "info",
          message: `Transport arrives in ${leg.intercityToCity} but next stay is in ${nextStay.cityLabel} — check intercity legs.`,
          section: "transport",
          entityType: "transport_leg",
          entityId: leg.id,
        });
      }
    }
  }

  return prompts;
}
