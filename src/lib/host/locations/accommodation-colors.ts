export type AccommodationStayLike = {
  id?: string;
  name: string | null;
  cityLabel: string;
  checkInDate: string;
  checkOutDate: string;
};

/** Stable hue (0–360) per stay id or normalized hotel name. */
export function stayHue(stay: {
  id?: string;
  name: string | null;
  cityLabel: string;
}): number {
  const key = (stay.id || (stay.name ?? stay.cityLabel)).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function stayColor(stay: {
  id?: string;
  name: string | null;
  cityLabel: string;
}): string {
  return `hsl(${stayHue(stay)} 62% 46%)`;
}

export function stayForNight<T extends AccommodationStayLike>(
  date: string,
  stays: T[],
): T | null {
  return (
    stays.find((s) => s.checkInDate <= date && s.checkOutDate >= date) ?? null
  );
}
