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

function pickCity(address: NominatimRow["address"]): string | null {
  if (!address) return null;
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    null
  );
}

function toSuggestion(row: NominatimRow): PlaceSuggestion {
  const city = pickCity(row.address) ?? row.name ?? row.display_name.split(",")[0]?.trim() ?? "";
  const region = row.address?.state ?? null;
  const country = row.address?.country ?? null;

  const shortLabel = [city, country].filter(Boolean).join(", ");

  return {
    id: String(row.place_id),
    label: row.display_name,
    shortLabel: shortLabel || row.display_name,
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
  url.searchParams.set("limit", String(params.limit ?? 10));
  url.searchParams.set("dedupe", "1");

  if (params.countryCodes?.length) {
    url.searchParams.set("countrycodes", params.countryCodes.join(",").toLowerCase());
  }

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "TripConnect/1.0 (school trip planner)",
      Accept: "application/json",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return [];

  const rows = (await res.json()) as NominatimRow[];
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];

  for (const row of rows) {
    const suggestion = toSuggestion(row);
    const key = suggestion.shortLabel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(suggestion);
  }

  return out;
}
