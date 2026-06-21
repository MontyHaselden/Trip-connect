import { placesShareMetro } from "@/lib/geo/airport-codes";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type { StayType } from "@/lib/host/wizard/types";

const PLACEHOLDER_CITIES = new Set(["tbc", "unknown", ""]);

export function sanitizeCityHint(cityHint?: string | null): string | undefined {
  const trimmed = cityHint?.trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_CITIES.has(trimmed.toLowerCase())) return undefined;
  return trimmed;
}

export function usesGoogleMapsSearch(stayType?: StayType): boolean {
  return stayType !== "not_booked";
}

function stripPostalSuffix(part: string): string {
  return part.replace(/\s+\d{3,6}(-\d{4})?$/, "").trim();
}

function looksLikeCountry(part: string): boolean {
  const lower = part.toLowerCase();
  return (
    lower.length >= 4 &&
    !/^\d/.test(part) &&
    !/district|prefecture|county|province|state/i.test(part)
  );
}

function looksLikeStreetPart(part: string): boolean {
  return /^\d/.test(part) || /^\d+\s/.test(part) || /^[\d\s-]+$/.test(part);
}

/** Best-effort "Locality, Region" from a Google/Nominatim formatted address. */
export function inferCityLabelFromAddress(address: string): string | null {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  let working = parts;
  if (working.length >= 3 && looksLikeCountry(working[working.length - 1]!)) {
    working = working.slice(0, -1);
  }

  let cleaned = working.map(stripPostalSuffix).filter((p) => p && !/^\d+$/.test(p));

  while (cleaned.length > 2 && looksLikeStreetPart(cleaned[0]!)) {
    cleaned = cleaned.slice(1);
  }

  if (!cleaned.length) return null;
  if (cleaned.length === 1) return cleaned[0]!;

  const region = cleaned[cleaned.length - 1]!;
  let locality = cleaned[cleaned.length - 2]!;

  if (/district$/i.test(locality) && cleaned.length >= 3) {
    const inner = cleaned[cleaned.length - 3]!;
    if (inner && !/district$/i.test(inner)) {
      return combineLocalityRegion(inner, region);
    }
    locality = locality.replace(/\s+district$/i, "").trim();
  }

  return combineLocalityRegion(locality, region);
}

function combineLocalityRegion(locality: string, region: string): string {
  if (!locality) return region;
  if (!region || locality.toLowerCase() === region.toLowerCase()) return locality;
  return `${locality}, ${region}`;
}

/** Maps formal admin / Google labels hosts should avoid on the calendar. */
export function looksLikeFormalMapsCityLabel(city: string): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;
  if (trimmed.includes(",")) return true;
  return /\b(tambon|amphoe|chang wat|changwat|province|prefecture|regency|kabupaten|district)\b/i.test(
    trimmed,
  );
}

const HOTEL_AREA_NAMES = [
  "Patong",
  "Kata",
  "Karon",
  "Kamala",
  "Bang Tao",
  "Rawai",
  "Chalong",
  "Seminyak",
  "Ubud",
  "Sukhumvit",
  "Silom",
  "Siam",
] as const;

/** Everyday stay label embedded in a hotel name (e.g. Patong in Royal Paradise … Patong Phuket). */
export function friendlyCityFromHotelName(hotelName: string): string | null {
  const trimmed = hotelName.trim();
  if (!trimmed) return null;
  for (const area of HOTEL_AREA_NAMES) {
    if (new RegExp(`\\b${area.replace(/\s+/g, "\\s+")}\\b`, "i").test(trimmed)) {
      return area;
    }
  }
  if (/\bpa\s*tong\b/i.test(trimmed)) return "Patong";
  return null;
}

/** Prefer a human stay label when Maps returns formal admin text. */
export function resolveStayCityOnHotelPick(input: {
  hotelName: string;
  mapsCityLabel?: string | null;
  address?: string | null;
  existingCity?: string;
}): string {
  const fromName = friendlyCityFromHotelName(input.hotelName);
  const maps = input.mapsCityLabel?.trim() ?? "";
  const fromAddress = input.address ? inferCityLabelFromAddress(input.address) : null;
  const inferred = maps || fromAddress || "";
  const existing = input.existingCity?.trim() ?? "";

  if (fromName) return fromName;

  if (existing && inferred) {
    if (locationsMatch(existing, inferred) || placesShareMetro(existing, inferred)) {
      return existing;
    }
  }

  if (inferred && !looksLikeFormalMapsCityLabel(inferred)) return inferred;
  if (existing && !looksLikeFormalMapsCityLabel(existing)) return existing;
  return inferred || existing;
}

/** Suggest a friendlier label when the effective city is formal or too broad for the hotel. */
export function suggestKeepStayCityLabel(input: {
  hotelName: string;
  effectiveCity: string;
}): string | null {
  const friendly = friendlyCityFromHotelName(input.hotelName);
  if (!friendly) return null;
  const effective = input.effectiveCity.trim();
  if (!effective) return friendly;
  if (effective.toLowerCase() === friendly.toLowerCase()) return null;
  if (looksLikeFormalMapsCityLabel(effective)) return friendly;
  const effectiveShort = effective.split(",")[0]?.trim().toLowerCase() ?? "";
  if (
    friendly === "Patong" &&
    (effectiveShort === "phuket" || effectiveShort.includes("phuket"))
  ) {
    return friendly;
  }
  return null;
}

export function accommodationSearchMode(stayType?: StayType): {
  lodgingOnly: boolean;
  querySuffix?: string;
  fieldLabel: string;
  placeholder: string;
} {
  switch (stayType) {
    case "hostel":
      return {
        lodgingOnly: true,
        querySuffix: "hostel",
        fieldLabel: "Hostel",
        placeholder: "Search hostels…",
      };
    case "homestay":
    case "multiple_hosts":
      return {
        lodgingOnly: false,
        querySuffix: "homestay",
        fieldLabel: "Homestay / host family",
        placeholder: "Search homestays or host families…",
      };
    case "multiple_hotels":
      return {
        lodgingOnly: true,
        fieldLabel: "Hotels",
        placeholder: "Search hotels…",
      };
    case "other":
      return {
        lodgingOnly: false,
        fieldLabel: "Property name",
        placeholder: "Search accommodation…",
      };
    case "not_booked":
    case "hotel":
    default:
      return {
        lodgingOnly: true,
        fieldLabel: "Hotel or property",
        placeholder: "Search hotels…",
      };
  }
}

const LODGING_STOP_WORDS = /^(hotel|hotels|inn|hostel|resort|the|a|an)$/i;

/** Split trailing city tokens out of hotel names like "The Knot Hiroshima". */
export function resolveLodgingSearchQuery(
  query: string,
  cityHint?: string,
): { query: string; cityHint?: string } {
  const trimmed = query.trim();
  const sanitizedHint = sanitizeCityHint(cityHint);
  const tokens = trimmed.split(/\s+/).filter(Boolean);

  if (tokens.length < 2) {
    return { query: trimmed, cityHint: sanitizedHint };
  }

  const last = tokens[tokens.length - 1]!;
  const lastLower = last.toLowerCase();
  const hintCity = sanitizedHint?.split(",")[0]?.trim().toLowerCase();

  if (
    last.length >= 3 &&
    !LODGING_STOP_WORDS.test(last) &&
    !/^\d/.test(last)
  ) {
    const namePart = tokens.slice(0, -1).join(" ").trim();
    if (namePart.length >= 2) {
      const sameAsHint =
        hintCity &&
        (hintCity === lastLower ||
          hintCity.includes(lastLower) ||
          lastLower.includes(hintCity));

      // Search the property name in the trailing city — even when it matches the hint.
      return {
        query: namePart,
        cityHint: sameAsHint ? sanitizedHint : last,
      };
    }
  }

  return { query: trimmed, cityHint: sanitizedHint };
}
