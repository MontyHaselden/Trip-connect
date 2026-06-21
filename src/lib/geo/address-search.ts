import { searchLodging } from "./lodging-search";
import type { LodgingSearchResult } from "./lodging-search";

export type { AddressSuggestion } from "./google-places";

export async function searchAddresses(params: {
  query: string;
  countryCodes?: string[];
  cityHint?: string;
  stayCity?: string;
  limit?: number;
  lodgingOnly?: boolean;
}): Promise<LodgingSearchResult[]> {
  const stayCity = params.stayCity ?? params.cityHint ?? "";
  const { suggestions } = await searchLodging({
    query: params.query,
    stayCity,
    countryCodes: params.countryCodes,
    lodgingOnly: params.lodgingOnly,
    limit: params.limit,
  });
  return suggestions;
}

export { searchLodging } from "./lodging-search";
export type {
  LodgingSearchContext,
  LodgingSearchMeta,
  LodgingSearchResponse,
  LodgingSearchResult,
} from "./lodging-search";
