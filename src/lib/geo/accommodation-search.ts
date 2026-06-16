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
