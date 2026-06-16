/** Normalized place record for future Maps / geocoding providers. */
export type PlaceRecord = {
  name: string | null;
  formattedAddress: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  mapsUrl: string | null;
};

export function placeRecordFromLabel(label: string): PlaceRecord {
  const parts = label.split(",").map((s) => s.trim());
  return {
    name: parts[0] ?? label,
    formattedAddress: label,
    city: parts[0] ?? null,
    region: parts.length > 2 ? parts[1] ?? null : null,
    country: parts[parts.length - 1] ?? null,
    latitude: null,
    longitude: null,
    placeId: null,
    mapsUrl: null,
  };
}
