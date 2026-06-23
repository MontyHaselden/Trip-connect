export type MapTileConfig = {
  url: string;
  attribution: string;
  subdomains?: string;
};

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Tile provider config — override via NEXT_PUBLIC_MAP_TILE_* env vars. */
export function getMapTileConfig(): MapTileConfig {
  return {
    url: process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL,
    attribution:
      process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_ATTRIBUTION,
    subdomains: "abc",
  };
}
