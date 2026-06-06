"use client";

import type { DayWeatherSnapshot } from "@/types/activity-category";
import { formatWeatherSummary } from "@/lib/weather/fetch-day-weather";
import { shortDayLabel } from "@/lib/utils/time";

export function DayWeatherStrip(props: {
  cityLabel: string;
  weather: DayWeatherSnapshot | null | undefined;
}) {
  const { cityLabel, weather } = props;

  if (!weather) return null;

  if (weather.status === "too_far") {
    return (
      <p className="text-xs text-zinc-500">Weather available closer to the date.</p>
    );
  }

  if (weather.status === "unavailable") {
    return null;
  }

  const locationLabel = shortDayLabel(cityLabel, 20) || cityLabel;
  const summary = formatWeatherSummary({
    locationLabel,
    tempC: weather.tempC,
    condition: weather.condition,
    advice: weather.advice,
  });

  return (
    <p className="text-xs leading-snug text-zinc-600">{summary}</p>
  );
}
