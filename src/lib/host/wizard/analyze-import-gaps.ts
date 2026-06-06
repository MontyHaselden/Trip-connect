import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems, tripDays, trips } from "@/lib/db/schema";

export type ImportGap = {
  id: string;
  kind:
    | "missing_city"
    | "city_change_no_transport"
    | "missing_hotel"
    | "missing_outbound"
    | "missing_return";
  message: string;
  date?: string;
  fromCity?: string;
  toCity?: string;
};

export async function analyzeImportGaps(tripId: string): Promise<ImportGap[]> {
  const gaps: ImportGap[] = [];

  const trip = await db
    .select({
      startDate: trips.startDate,
      endDate: trips.endDate,
      departureCity: trips.departureCity,
      returnCity: trips.returnCity,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) return gaps;

  const days = await db
    .select({
      id: tripDays.id,
      date: tripDays.date,
      cityLabel: tripDays.cityLabel,
    })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.date));

  const items = await db
    .select({
      tripDayId: itineraryItems.tripDayId,
      category: itineraryItems.category,
      title: itineraryItems.title,
    })
    .from(itineraryItems)
    .where(eq(itineraryItems.tripId, tripId));

  const travelByDay = new Map<string, number>();
  const hotelByDay = new Map<string, number>();
  for (const item of items) {
    if (item.category === "travel") {
      travelByDay.set(item.tripDayId, (travelByDay.get(item.tripDayId) ?? 0) + 1);
    }
    if (item.category === "hotel") {
      hotelByDay.set(item.tripDayId, (hotelByDay.get(item.tripDayId) ?? 0) + 1);
    }
  }

  for (const day of days) {
    const city = day.cityLabel.trim();
    if (!city || city === "TBC" || city.toLowerCase() === "unknown") {
      gaps.push({
        id: `city-${day.date}`,
        kind: "missing_city",
        message: `${day.date}: set the city or location for this day`,
        date: day.date,
      });
    }
  }

  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1]!;
    const curr = days[i]!;
    const prevCity = prev.cityLabel.trim();
    const currCity = curr.cityLabel.trim();
    if (!prevCity || !currCity) continue;
    if (prevCity.toLowerCase() === currCity.toLowerCase()) continue;

    const hasTravel = (travelByDay.get(curr.id) ?? 0) > 0;
    if (!hasTravel) {
      gaps.push({
        id: `transport-${curr.date}`,
        kind: "city_change_no_transport",
        message: `${curr.date}: how are you getting from ${prevCity} to ${currCity}?`,
        date: curr.date,
        fromCity: prevCity,
        toCity: currCity,
      });
    }
  }

  for (let i = 0; i < days.length - 1; i++) {
    const day = days[i]!;
    const city = day.cityLabel.trim();
    if (!city || city === "TBC") continue;
    const hasHotel =
      (hotelByDay.get(day.id) ?? 0) > 0 ||
      days.some((d) => d.date > day.date && d.cityLabel.trim() === city);
    if (!hasHotel && day.date >= trip.startDate && day.date < trip.endDate) {
      gaps.push({
        id: `hotel-${day.date}`,
        kind: "missing_hotel",
        message: `${day.date}: where is the group staying in ${city}?`,
        date: day.date,
        toCity: city,
      });
    }
  }

  const startDay = days.find((d) => d.date === trip.startDate);
  if (startDay && (travelByDay.get(startDay.id) ?? 0) === 0) {
    gaps.push({
      id: "outbound-transport",
      kind: "missing_outbound",
      message: `Outbound travel on ${trip.startDate} not found`,
      date: trip.startDate,
      fromCity: trip.departureCity ?? undefined,
    });
  }

  const endDay = days.find((d) => d.date === trip.endDate);
  if (endDay && (travelByDay.get(endDay.id) ?? 0) === 0) {
    gaps.push({
      id: "return-transport",
      kind: "missing_return",
      message: `Return travel on ${trip.endDate} not found`,
      date: trip.endDate,
      toCity: trip.returnCity ?? undefined,
    });
  }

  return gaps;
}
