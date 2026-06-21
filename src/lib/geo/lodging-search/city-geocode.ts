export type GeocodedCity = {
  lat: number;
  lng: number;
  name: string;
};

const cache = new Map<string, GeocodedCity | null>();

function cacheKey(city: string, countryCodes?: string[]): string {
  const cityPart = city.trim().toLowerCase();
  const countryPart = countryCodes?.join(",").toLowerCase() ?? "";
  return `${cityPart}|${countryPart}`;
}

async function fetchGeocode(query: string): Promise<GeocodedCity | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query.trim());
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
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
    lat: hit.latitude,
    lng: hit.longitude,
    name: hit.country ? `${hit.name}, ${hit.country}` : hit.name,
  };
}

/** Geocode the authoritative stay city for Google location bias. */
export async function geocodeStayCity(
  stayCity: string,
  countryCodes?: string[],
): Promise<GeocodedCity | null> {
  const trimmed = stayCity.trim();
  if (!trimmed) return null;

  const key = cacheKey(trimmed, countryCodes);
  if (cache.has(key)) return cache.get(key) ?? null;

  const cityPart = trimmed.split(",")[0]?.trim() ?? trimmed;
  let result = await fetchGeocode(cityPart);

  if (!result && countryCodes?.length) {
    result = await fetchGeocode(`${cityPart}, ${countryCodes[0]}`);
  }

  cache.set(key, result);
  return result;
}

/** Test helper — clear module cache between tests. */
export function clearCityGeocodeCache(): void {
  cache.clear();
}
