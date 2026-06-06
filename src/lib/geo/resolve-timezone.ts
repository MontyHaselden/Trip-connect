import { DateTime } from "luxon";

import { COUNTRIES } from "./countries";

const HOME_TIMEZONE = "Pacific/Auckland";

/** Fallback IANA zones when geocoding is unavailable */
const COUNTRY_TIMEZONE: Record<string, string> = {
  Japan: "Asia/Tokyo",
  "New Zealand": "Pacific/Auckland",
  Australia: "Australia/Sydney",
  "United Kingdom": "Europe/London",
  "United States of America": "America/New_York",
  France: "Europe/Paris",
  Germany: "Europe/Berlin",
  China: "Asia/Shanghai",
  "South Korea": "Asia/Seoul",
  Singapore: "Asia/Singapore",
  Thailand: "Asia/Bangkok",
  Vietnam: "Asia/Ho_Chi_Minh",
  Fiji: "Pacific/Fiji",
  Canada: "America/Toronto",
};

const TZ_SHORT: Record<string, string> = {
  "Pacific/Auckland": "NZT",
  "Asia/Tokyo": "JST",
  "Australia/Sydney": "AEST",
  "Europe/London": "GMT",
  "America/New_York": "ET",
  "Asia/Seoul": "KST",
  "Asia/Shanghai": "CST",
};

type GeocodeHit = {
  timezone?: string;
};

async function geocodeTimezone(query: string): Promise<string | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: GeocodeHit[] };
    const tz = data.results?.[0]?.timezone;
    return tz && tz.includes("/") ? tz : null;
  } catch {
    return null;
  }
}

function countryTimezone(countryName: string): string | null {
  const direct = COUNTRY_TIMEZONE[countryName];
  if (direct) return direct;
  const match = COUNTRIES.find((c) => c.name.toLowerCase() === countryName.toLowerCase());
  return match ? (COUNTRY_TIMEZONE[match.name] ?? null) : null;
}

function modeCity(cities: string[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of cities) {
    const city = raw.trim();
    if (!city) continue;
    const key = city.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = cities.find((c) => c.trim().toLowerCase() === key)?.trim() ?? null;
    }
  }
  return best;
}

export async function inferTripTimezone(input: {
  countries?: string[];
  cities?: string[];
  departureCity?: string;
}): Promise<string> {
  const candidates: string[] = [];

  const topCity = modeCity(input.cities ?? []);
  if (topCity) candidates.push(topCity);

  for (const country of input.countries ?? []) {
    candidates.push(country);
    const tz = countryTimezone(country);
    if (tz) {
      // country fallback appended after city attempts
    }
  }

  if (input.departureCity?.trim()) {
    candidates.push(input.departureCity.trim());
  }

  for (const query of candidates) {
    const tz = await geocodeTimezone(query);
    if (tz) return tz;
  }

  for (const country of input.countries ?? []) {
    const tz = countryTimezone(country);
    if (tz) return tz;
  }

  return HOME_TIMEZONE;
}

export function timezoneShortAbbr(iana: string, at: DateTime = DateTime.now()): string {
  if (TZ_SHORT[iana]) return TZ_SHORT[iana]!;
  const abbr = at.setZone(iana).toFormat("ZZZZ");
  return abbr || iana;
}

export function timezoneLongName(iana: string, at: DateTime = DateTime.now()): string {
  const dt = at.setZone(iana);
  const long = dt.offsetNameLong;
  if (long && long !== "UTC") return long;
  return iana.replace(/_/g, " ").split("/").pop() ?? iana;
}

export type TimezoneDisplay = {
  iana: string;
  label: string;
  shortAbbr: string;
  homeIana: string;
  homeAbbr: string;
  isHome: boolean;
};

export function buildTimezoneDisplay(
  tripIana: string,
  homeIana: string = HOME_TIMEZONE,
  at?: string,
): TimezoneDisplay {
  const ref = at ? DateTime.fromISO(at) : DateTime.now();
  const shortAbbr = timezoneShortAbbr(tripIana, ref);
  const longName = timezoneLongName(tripIana, ref);
  const homeAbbr = timezoneShortAbbr(homeIana, ref);
  const isHome = tripIana === homeIana;

  return {
    iana: tripIana,
    shortAbbr,
    label: isHome
      ? `${longName} (${shortAbbr}) — home time`
      : `${longName} (${shortAbbr}) — local trip time`,
    homeIana,
    homeAbbr,
    isHome,
  };
}

export async function inferTimezoneFromWizardBasics(basics: {
  destinationCountries: string[];
  departureCity: string;
  returnCity: string;
  dayPlaces?: Array<{ primaryCity: string; dayType: string }>;
}): Promise<string> {
  const cities =
    basics.dayPlaces
      ?.filter((d) => d.dayType !== "buffer" && d.primaryCity.trim())
      .map((d) => d.primaryCity) ?? [];

  if (!cities.length && basics.departureCity.trim()) {
    cities.push(basics.departureCity);
  }

  return inferTripTimezone({
    countries: basics.destinationCountries,
    cities,
    departureCity: basics.departureCity,
  });
}
