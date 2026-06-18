import type { TripOutlineDay, TripOutlineResult } from "@/lib/ai/parse-trip-outline";
import type { TripStructureResult } from "@/lib/ai/parse-trip-structure-from-document";
import { repairIsoDate } from "@/lib/utils/iso-date";

function dedupeOutlineDays(days: TripOutlineDay[]): TripOutlineDay[] {
  const byDate = new Map<string, TripOutlineDay>();
  for (const day of days) {
    const existing = byDate.get(day.date);
    if (!existing) {
      byDate.set(day.date, day);
      continue;
    }
    byDate.set(day.date, {
      date: day.date,
      cityLabel: day.cityLabel.trim() || existing.cityLabel,
      summary: day.summary ?? existing.summary ?? null,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function sanitizeTripOutlineDates(outline: TripOutlineResult): TripOutlineResult {
  const startDate = repairIsoDate(outline.startDate);
  const endDate = repairIsoDate(outline.endDate);
  const days = dedupeOutlineDays(
    outline.days
      .map((day) => ({
        ...day,
        date: repairIsoDate(day.date),
      }))
      .filter((day) => day.date >= startDate && day.date <= endDate),
  );

  return {
    ...outline,
    startDate,
    endDate,
    days,
  };
}

function repairLegDates<T extends { travelDate: string; arrivalDate?: string | null }>(leg: T): T {
  return {
    ...leg,
    travelDate: repairIsoDate(leg.travelDate),
    arrivalDate: leg.arrivalDate ? repairIsoDate(leg.arrivalDate) : leg.arrivalDate ?? null,
  };
}

export function sanitizeTripStructureDates(structure: TripStructureResult): TripStructureResult {
  const dayByDate = new Map<string, TripStructureResult["dayPlaces"][number]>();
  for (const day of structure.dayPlaces) {
    const date = repairIsoDate(day.date);
    const existing = dayByDate.get(date);
    if (!existing) {
      dayByDate.set(date, { ...day, date });
      continue;
    }
    dayByDate.set(date, {
      ...existing,
      primaryCity: day.primaryCity.trim() || existing.primaryCity,
      secondaryCity: day.secondaryCity?.trim() ? day.secondaryCity : existing.secondaryCity,
      primaryShare: day.secondaryCity?.trim() ? day.primaryShare : existing.primaryShare,
      dayType: day.dayType === "travel" || existing.dayType === "travel" ? "travel" : day.dayType,
    });
  }

  return {
    ...structure,
    dayPlaces: [...dayByDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    outboundLegs: structure.outboundLegs.map(repairLegDates),
    returnLegs: structure.returnLegs.map(repairLegDates),
    intercityLegs: structure.intercityLegs.map(repairLegDates),
    accommodationStays: structure.accommodationStays.map((stay) => ({
      ...stay,
      checkInDate: repairIsoDate(stay.checkInDate),
      checkOutDate: repairIsoDate(stay.checkOutDate),
    })),
  };
}
