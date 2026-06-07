import { countryCodeToName } from "./countries";

export type PlaceSuggestion = {
  id: string;
  label: string;
  shortLabel: string;
  city: string | null;
  region: string | null;
  country: string | null;
};

type NominatimRow = {
  place_id: number;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  namedetails?: Record<string, string>;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
};

const NON_LATIN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0600-\u06ff]/;

function isLatinText(value: string): boolean {
  return value.trim().length > 0 && !NON_LATIN.test(value);
}

function pickAddressLocality(address: NominatimRow["address"]): string | null {
  if (!address) return null;
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    null
  );
}

function englishCountry(address: NominatimRow["address"]): string | null {
  if (!address) return null;
  const fromCode = address.country_code
    ? countryCodeToName(address.country_code)
    : null;
  if (fromCode) return fromCode;
  const raw = address.country?.trim();
  return raw && isLatinText(raw) ? raw : null;
}

function englishRegion(address: NominatimRow["address"]): string | null {
  const raw = address?.state?.trim();
  return raw && isLatinText(raw) ? raw : null;
}

function englishPlaceName(row: NominatimRow): string {
  const namedetails = row.namedetails ?? {};
  const candidates = [
    namedetails["name:en"],
    row.name,
    pickAddressLocality(row.address),
    row.display_name.split(",")[0]?.trim(),
  ].filter((v): v is string => Boolean(v?.trim()));

  for (const candidate of candidates) {
    if (isLatinText(candidate)) return candidate.trim();
  }

  return candidates[0]?.trim() ?? row.display_name;
}

function toSuggestion(row: NominatimRow): PlaceSuggestion {
  const city = englishPlaceName(row);
  const region = englishRegion(row.address);
  const country = englishCountry(row.address);
  const shortLabel = [city, country].filter(Boolean).join(", ");
  const label = [city, region, country].filter(Boolean).join(", ");

  return {
    id: String(row.place_id),
    label: label || shortLabel || row.display_name,
    shortLabel: shortLabel || label || row.display_name,
    city: city || null,
    region,
    country,
  };
}

export async function searchPlaces(params: {
  query: string;
  countryCodes?: string[];
  limit?: number;
}): Promise<PlaceSuggestion[]> {
  const q = params.query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("accept-language", "en");
  url.searchParams.set("limit", String(params.limit ?? 10));
  url.searchParams.set("dedupe", "1");

  if (params.countryCodes?.length) {
    url.searchParams.set("countrycodes", params.countryCodes.join(",").toLowerCase());
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TripConnect/1.0 (school trip planner)",
      Accept: "application/json",
      "Accept-Language": "en",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return [];

  const rows = (await res.json()) as NominatimRow[];
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];

  for (const row of rows) {
    const suggestion = toSuggestion(row);
    if (!isLatinText(suggestion.shortLabel)) continue;
    const key = suggestion.shortLabel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
  }

  if (out.length) return out;

  return searchOpenMeteoPlaces({ query: q, countryCodes: params.countryCodes, limit: params.limit });
}

type OpenMeteoHit = {
  id: number;
  name: string;
  country?: string;
  country_code?: string;
  admin1?: string;
};

async function searchOpenMeteoPlaces(params: {
  query: string;
  countryCodes?: string[];
  limit?: number;
}): Promise<PlaceSuggestion[]> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", params.query);
  url.searchParams.set("count", String(params.limit ?? 10));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: OpenMeteoHit[] };
    const seen = new Set<string>();
    const out: PlaceSuggestion[] = [];

    for (const row of data.results ?? []) {
      const country =
        (row.country_code ? countryCodeToName(row.country_code) : null) ??
        row.country ??
        null;
      if (
        params.countryCodes?.length &&
        row.country_code &&
        !params.countryCodes.map((c) => c.toLowerCase()).includes(row.country_code.toLowerCase())
      ) {
        continue;
      }
      const city = row.name.trim();
      if (!city || !isLatinText(city)) continue;
      const shortLabel = [city, country].filter(Boolean).join(", ");
      const key = shortLabel.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `om-${row.id}`,
        label: [city, row.admin1, country].filter(Boolean).join(", "),
        shortLabel,
        city,
        region: row.admin1 ?? null,
        country,
      });
    }

    return out;
  } catch {
    return [];
  }
}
