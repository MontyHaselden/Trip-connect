import type { AddressSuggestion } from "./google-places";
import { searchGoogleAddresses } from "./google-places";
import { resolveLodgingSearchQuery } from "./accommodation-search";

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

async function runAddressSearch(params: {
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

export async function searchAddresses(params: {
  query: string;
  countryCodes?: string[];
  cityHint?: string;
  limit?: number;
  lodgingOnly?: boolean;
}): Promise<AddressSuggestion[]> {
  const resolved = resolveLodgingSearchQuery(params.query, params.cityHint);
  const base = {
    countryCodes: params.countryCodes,
    limit: params.limit,
    lodgingOnly: params.lodgingOnly,
  };

  const attempts: Array<{ query: string; cityHint?: string }> = [
    resolved,
    { query: resolved.query, cityHint: undefined },
    { query: params.query.trim(), cityHint: undefined },
  ];

  if (/^the\s+/i.test(resolved.query)) {
    attempts.push({
      query: resolved.query.replace(/^the\s+/i, "").trim(),
      cityHint: resolved.cityHint,
    });
  }

  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];

  for (const attempt of attempts) {
    if (attempt.query.length < 2) continue;
    const key = `${attempt.query.toLowerCase()}|${attempt.cityHint?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const batch = await runAddressSearch({ ...base, ...attempt });
    for (const row of batch) {
      const dedupe = row.label.toLowerCase();
      if (out.some((existing) => existing.label.toLowerCase() === dedupe)) continue;
      out.push(row);
    }
    if (out.length) return out.slice(0, params.limit ?? 10);
  }

  return out;
}

export type { AddressSuggestion };
