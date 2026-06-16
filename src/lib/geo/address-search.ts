import type { AddressSuggestion } from "./google-places";
import { searchGoogleAddresses } from "./google-places";

type NominatimRow = {
  place_id: number;
  display_name: string;
  name?: string;
  class?: string;
  type?: string;
};

const NON_LATIN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0600-\u06ff]/;

function isLatinText(value: string): boolean {
  return value.trim().length > 0 && !NON_LATIN.test(value);
}

async function searchNominatimAddresses(params: {
  query: string;
  countryCodes?: string[];
  cityHint?: string;
  limit?: number;
  lodgingOnly?: boolean;
}): Promise<AddressSuggestion[]> {
  const q = params.query.trim();
  if (q.length < 2) return [];

  const cityPart = params.cityHint
    ? params.cityHint.split(",")[0]?.trim() ?? params.cityHint
    : "";
  const searchQuery = params.lodgingOnly
    ? cityPart
      ? `${q} hotel, ${cityPart}`
      : `${q} hotel`
    : cityPart
      ? `${q}, ${cityPart}`
      : q;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");
  url.searchParams.set("accept-language", "en");
  url.searchParams.set("limit", String(params.limit ?? 10));
  url.searchParams.set("dedupe", "1");

  if (params.countryCodes?.length) {
    url.searchParams.set("countrycodes", params.countryCodes.join(",").toLowerCase());
  }

  try {
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
    const out: AddressSuggestion[] = [];

    for (const row of rows) {
      const displayName = row.display_name.trim();
      if (!displayName || !isLatinText(displayName)) continue;

      const name =
        row.name?.trim() && isLatinText(row.name) ? row.name.trim() : displayName.split(",")[0]?.trim();
      if (!name) continue;

      const key = displayName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const parts = displayName.split(",").map((p) => p.trim());
      const sublabel = parts.slice(1, 3).join(", ") || undefined;

      out.push({
        id: String(row.place_id),
        label: name,
        sublabel,
        address: displayName,
        name,
        source: "nominatim",
      });
    }

    return out;
  } catch {
    return [];
  }
}

export async function searchAddresses(params: {
  query: string;
  countryCodes?: string[];
  cityHint?: string;
  limit?: number;
  lodgingOnly?: boolean;
}): Promise<AddressSuggestion[]> {
  const google = await searchGoogleAddresses(params);
  if (google.length) return google;
  return searchNominatimAddresses(params);
}

export type { AddressSuggestion };
