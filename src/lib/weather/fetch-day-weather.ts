import { DateTime } from "luxon";

import type { DayWeatherSnapshot } from "@/types/activity-category";

const FORECAST_DAYS = 16;

type GeocodeResult = {
  latitude: number;
  longitude: number;
  name: string;
};

type WeatherCodeInfo = {
  condition: string;
  advice: string | null;
};

const WEATHER_CODES: Record<number, WeatherCodeInfo> = {
  0: { condition: "clear sky", advice: null },
  1: { condition: "mainly clear", advice: null },
  2: { condition: "partly cloudy", advice: null },
  3: { condition: "overcast", advice: null },
  45: { condition: "fog", advice: "Low visibility — take care." },
  48: { condition: "fog", advice: "Low visibility — take care." },
  51: { condition: "light drizzle", advice: "Bring a light jacket." },
  53: { condition: "drizzle", advice: "Bring a light jacket." },
  55: { condition: "heavy drizzle", advice: "Bring a rain jacket." },
  56: { condition: "freezing drizzle", advice: "Dress warmly." },
  57: { condition: "freezing drizzle", advice: "Dress warmly." },
  61: { condition: "light rain", advice: "Bring umbrella." },
  63: { condition: "rain", advice: "Bring umbrella." },
  65: { condition: "heavy rain", advice: "Bring umbrella and waterproof jacket." },
  66: { condition: "freezing rain", advice: "Dress warmly and take care on paths." },
  67: { condition: "freezing rain", advice: "Dress warmly and take care on paths." },
  71: { condition: "light snow", advice: "Dress warmly." },
  73: { condition: "snow", advice: "Dress warmly and wear sturdy shoes." },
  75: { condition: "heavy snow", advice: "Dress warmly and allow extra travel time." },
  77: { condition: "snow grains", advice: "Dress warmly." },
  80: { condition: "light showers", advice: "Bring umbrella." },
  81: { condition: "showers", advice: "Bring umbrella." },
  82: { condition: "heavy showers", advice: "Bring umbrella and waterproof jacket." },
  85: { condition: "snow showers", advice: "Dress warmly." },
  86: { condition: "heavy snow showers", advice: "Dress warmly." },
  95: { condition: "thunderstorm", advice: "Seek shelter if storms develop." },
  96: { condition: "thunderstorm with hail", advice: "Seek shelter." },
  99: { condition: "thunderstorm with hail", advice: "Seek shelter." },
};

function weatherFromCode(code: number): WeatherCodeInfo {
  return WEATHER_CODES[code] ?? { condition: "variable conditions", advice: null };
}

async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query.trim());
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    results?: Array<{
      latitude: number;
      longitude: number;
      name: string;
      country?: string;
    }>;
  };

  const hit = body.results?.[0];
  if (!hit) return null;

  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    name: hit.country ? `${hit.name}, ${hit.country}` : hit.name,
  };
}

export function formatWeatherSummary(params: {
  locationLabel: string;
  tempC: number | null;
  condition: string | null;
  advice: string | null;
}): string {
  const parts: string[] = [params.locationLabel];
  const weatherParts: string[] = [];
  if (params.tempC !== null) weatherParts.push(`${params.tempC}°C`);
  if (params.condition) weatherParts.push(params.condition);
  if (weatherParts.length) parts.push(weatherParts.join(", "));
  let line = parts.join(" — ");
  if (params.advice) line += `. ${params.advice}`;
  return line;
}

export async function fetchDayWeather(params: {
  dateISO: string;
  cityLabel: string;
  tripTimezone: string;
}): Promise<DayWeatherSnapshot> {
  const { dateISO, cityLabel, tripTimezone } = params;
  const locationQuery = cityLabel.trim();

  if (!locationQuery) {
    return {
      locationQuery: "",
      tempC: null,
      condition: null,
      advice: null,
      status: "unavailable",
      fetchedAt: new Date().toISOString(),
    };
  }

  const targetDay = DateTime.fromISO(dateISO, { zone: tripTimezone }).startOf("day");
  const today = DateTime.now().setZone(tripTimezone).startOf("day");
  const daysAhead = Math.floor(targetDay.diff(today, "days").days);

  if (daysAhead > FORECAST_DAYS) {
    return {
      locationQuery,
      tempC: null,
      condition: null,
      advice: null,
      status: "too_far",
      fetchedAt: new Date().toISOString(),
    };
  }

  const geo = await geocodeLocation(locationQuery);
  if (!geo) {
    return {
      locationQuery,
      tempC: null,
      condition: null,
      advice: null,
      status: "unavailable",
      fetchedAt: new Date().toISOString(),
    };
  }

  const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(geo.latitude));
  forecastUrl.searchParams.set("longitude", String(geo.longitude));
  forecastUrl.searchParams.set("daily", "weather_code,temperature_2m_max");
  forecastUrl.searchParams.set("timezone", tripTimezone);
  forecastUrl.searchParams.set("forecast_days", String(FORECAST_DAYS));

  const res = await fetch(forecastUrl.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    return {
      locationQuery,
      tempC: null,
      condition: null,
      advice: null,
      status: "unavailable",
      fetchedAt: new Date().toISOString(),
    };
  }

  const body = (await res.json()) as {
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
    };
  };

  const times = body.daily?.time ?? [];
  const idx = times.indexOf(dateISO);
  if (idx < 0) {
    return {
      locationQuery,
      tempC: null,
      condition: null,
      advice: null,
      status: daysAhead > FORECAST_DAYS ? "too_far" : "unavailable",
      fetchedAt: new Date().toISOString(),
    };
  }

  const code = body.daily?.weather_code?.[idx] ?? 0;
  const tempRaw = body.daily?.temperature_2m_max?.[idx];
  const tempC =
    typeof tempRaw === "number" && Number.isFinite(tempRaw)
      ? Math.round(tempRaw)
      : null;
  const { condition, advice } = weatherFromCode(code);

  return {
    locationQuery,
    tempC,
    condition,
    advice,
    status: "available",
    fetchedAt: new Date().toISOString(),
  };
}
