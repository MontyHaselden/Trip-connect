export function formatHeaderWeatherLine(
  weather: {
    status: string;
    tempC: number | null;
    condition: string | null;
    advice: string | null;
  } | null | undefined,
): string | null {
  if (!weather || weather.status !== "available") return null;

  const parts: string[] = [];
  if (weather.condition) {
    parts.push(
      weather.condition.charAt(0).toUpperCase() + weather.condition.slice(1),
    );
  }
  if (weather.tempC !== null) parts.push(`${weather.tempC}°C`);
  if (weather.advice) parts.push(weather.advice);

  return parts.length ? parts.join(" · ") : null;
}
