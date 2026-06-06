import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { dayWeatherSnapshots, tripDays, trips } from "@/lib/db/schema";
import { fetchDayWeather } from "@/lib/weather/fetch-day-weather";

export async function refreshTripWeather(tripId: string): Promise<void> {
  const trip = await db
    .select({ timezone: trips.timezone })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) return;

  const days = await db
    .select({
      id: tripDays.id,
      date: tripDays.date,
      cityLabel: tripDays.cityLabel,
    })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId));

  for (const day of days) {
    const weather = await fetchDayWeather({
      dateISO: day.date,
      cityLabel: day.cityLabel,
      tripTimezone: trip.timezone,
    });

    await db
      .insert(dayWeatherSnapshots)
      .values({
        tripDayId: day.id,
        locationQuery: weather.locationQuery,
        tempC: weather.tempC,
        condition: weather.condition,
        advice: weather.advice,
        status: weather.status,
        fetchedAt: new Date(weather.fetchedAt),
      })
      .onConflictDoUpdate({
        target: dayWeatherSnapshots.tripDayId,
        set: {
          locationQuery: weather.locationQuery,
          tempC: weather.tempC,
          condition: weather.condition,
          advice: weather.advice,
          status: weather.status,
          fetchedAt: new Date(weather.fetchedAt),
        },
      });
  }
}
