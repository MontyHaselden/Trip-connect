import { countryCodeToName } from "./countries";
import type { PlaceSuggestion } from "./nominatim";

type NominatimRow = {
  place_id: number;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  importance?: number;
  namedetails?: Record<string, string>;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
    aeroway?: string;
  };
};

const NON_LATIN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0600-\u06ff]/;

function isLatinText(value: string): boolean {
  return value.trim().length > 0 && !NON_LATIN.test(value);
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

function airportName(row: NominatimRow): string {
  const namedetails = row.namedetails ?? {};
  const candidates = [
    namedetails["name:en"],
    namedetails["alt_name:en"],
    row.name,
    row.address?.aeroway,
    row.display_name.split(",")[0]?.trim(),
  ].filter((v): v is string => Boolean(v?.trim()));

  for (const candidate of candidates) {
    if (isLatinText(candidate)) return candidate.trim();
  }

  return candidates[0]?.trim() ?? row.display_name;
}

function locality(row: NominatimRow): string {
  const address = row.address;
  if (!address) return "";
  return (
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    ""
  ).trim();
}

const NON_COMMERCIAL_AERODROME =
  /\b(heliport|helipad|helistop|seaplane|floatplane|ultralight|glider|airfield strip|ferry terminal|military)\b/i;

function isAirportRow(row: NominatimRow): boolean {
  if (row.class !== "aeroway" || row.type !== "aerodrome") return false;
  const name = airportName(row);
  const display = row.display_name;
  if (NON_COMMERCIAL_AERODROME.test(name) || NON_COMMERCIAL_AERODROME.test(display)) {
    return false;
  }
  return true;
}

function toAirportSuggestion(row: NominatimRow): PlaceSuggestion {
  const name = airportName(row);
  const country = englishCountry(row.address);
  const iata = row.namedetails?.iata?.trim().toUpperCase();
  const codeSuffix = iata ? ` (${iata})` : "";
  const shortLabel = [name, country].filter(Boolean).join(", ");
  const label = `${name}${codeSuffix}${country ? `, ${country}` : ""}`;

  return {
    id: `apt-${row.place_id}`,
    label,
    shortLabel,
    city: name,
    region: row.address?.state?.trim() && isLatinText(row.address.state) ? row.address.state : null,
    country,
  };
}

function relevanceScore(row: NominatimRow, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = airportName(row).toLowerCase();
  const display = row.display_name.toLowerCase();
  const city = locality(row).toLowerCase();
  const iata = row.namedetails?.iata?.trim().toLowerCase() ?? "";
  const altNames = Object.values(row.namedetails ?? {})
    .join(" ")
    .toLowerCase();

  let score = row.importance ?? 0;

  if (name.includes(q)) score += 120;
  if (city.includes(q)) score += 100;
  if (display.includes(q)) score += 80;
  if (altNames.includes(q)) score += 60;

  if (q.length === 3 && iata === q) score += 150;

  if (name.includes("international")) score += 40;
  if (iata) score += 25;

  // "tokyo" must not match IATA "TOK" — only exact 3-letter code lookups count.
  if (q.length > 3 && iata && iata !== q && (iata.startsWith(q) || q.startsWith(iata))) {
    score -= 200;
  }

  if (q.length >= 4 && !name.includes(q) && !city.includes(q) && !display.includes(q) && !altNames.includes(q)) {
    score -= 100;
  }

  return score;
}

async function fetchNominatimAirports(
  query: string,
  countryCodes?: string[],
  limit = 12,
): Promise<NominatimRow[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("accept-language", "en");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("dedupe", "1");

  if (countryCodes?.length) {
    url.searchParams.set("countrycodes", countryCodes.join(",").toLowerCase());
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
  return (await res.json()) as NominatimRow[];
}

function buildSearchQueries(query: string): string[] {
  const q = query.trim();
  const lower = q.toLowerCase();
  const queries = new Set<string>();

  // Only treat as an IATA code when the user typed 3 uppercase letters (e.g. NRT).
  if (/^[A-Z]{3}$/.test(q)) {
    queries.add(`${q} airport`);
  }

  if (lower.includes("airport")) {
    queries.add(q);
  } else {
    queries.add(`${q} airport`);
    if (q.length >= 4) {
      queries.add(`${q} international airport`);
    }
  }

  return [...queries];
}

function rankAirports(rows: NominatimRow[], query: string, limit: number): PlaceSuggestion[] {
  const seen = new Set<string>();
  const scored: Array<{ suggestion: PlaceSuggestion; score: number }> = [];

  for (const row of rows) {
    if (!isAirportRow(row)) continue;

    const score = relevanceScore(row, query);
    if (score < 0) continue;

    const suggestion = toAirportSuggestion(row);
    if (!isLatinText(suggestion.shortLabel)) continue;

    const iata = row.namedetails?.iata?.toUpperCase();
    const key = iata ?? suggestion.shortLabel.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    scored.push({ suggestion, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((entry) => entry.suggestion);
}

export async function searchAirports(params: {
  query: string;
  countryCodes?: string[];
  limit?: number;
}): Promise<PlaceSuggestion[]> {
  const query = params.query.trim();
  if (query.length < 3) return [];

  const limit = params.limit ?? 8;
  const rows: NominatimRow[] = [];

  for (const searchQuery of buildSearchQueries(query)) {
    const batch = await fetchNominatimAirports(searchQuery, params.countryCodes, 12);
    rows.push(...batch);
    if (rankAirports(rows, query, limit).length >= limit) break;
  }

  return rankAirports(rows, query, limit);
}
