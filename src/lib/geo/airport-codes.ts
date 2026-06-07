/** Best-effort IATA code for calendar flight strips and labels. */
const CITY_IATA: Record<string, string> = {
  christchurch: "CHC",
  auckland: "AKL",
  wellington: "WLG",
  queenstown: "ZQN",
  dunedin: "DUD",
  tokyo: "NRT",
  narita: "NRT",
  haneda: "HND",
  osaka: "KIX",
  kyoto: "UKY",
  sydney: "SYD",
  melbourne: "MEL",
  brisbane: "BNE",
  singapore: "SIN",
  london: "LHR",
  "los angeles": "LAX",
};

export function airportCodeFromPlace(place: string): string {
  const trimmed = place.trim();
  if (!trimmed) return "—";

  const paren = /\(([A-Za-z]{3})\)/.exec(trimmed);
  if (paren?.[1]) return paren[1].toUpperCase();

  const firstPart = trimmed.split(",")[0]?.trim() ?? trimmed;
  const lower = firstPart.toLowerCase();

  if (CITY_IATA[lower]) return CITY_IATA[lower];

  for (const [name, code] of Object.entries(CITY_IATA)) {
    if (lower.includes(name)) return code;
  }

  const words = firstPart.split(/\s+/).filter(Boolean);
  const lastWord = words[words.length - 1]?.toLowerCase() ?? lower;
  if (CITY_IATA[lastWord]) return CITY_IATA[lastWord];

  if (firstPart.length >= 3) {
    return firstPart
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 3)
      .toUpperCase();
  }

  return firstPart.toUpperCase();
}

export function flightRouteAirportCodes(
  legs: Array<{ fromCity: string; toCity: string }>,
): string[] {
  if (!legs.length) return [];
  const codes: string[] = [airportCodeFromPlace(legs[0]!.fromCity)];
  for (const leg of legs) {
    codes.push(airportCodeFromPlace(leg.toCity));
  }
  return codes;
}

/** e.g. CHC → AKL → NRT for same-day connection legs (hub is not a separate stay). */
export function flightRouteAirportLabel(legs: Array<{ fromCity: string; toCity: string }>): string {
  const codes = flightRouteAirportCodes(legs);
  if (!codes.length) return "Flying";
  return codes.join(" → ");
}

export function isAirportRouteLabel(label: string): boolean {
  return /^[A-Z]{3}( → [A-Z]{3})+$/.test(label.trim());
}

export function parseAirportRouteLabel(label: string): string[] {
  if (!isAirportRouteLabel(label)) return [];
  return label.split(" → ").map((c) => c.trim());
}

/** IATA code → metro area key for comparing airport endpoints to painted cities. */
const METRO_BY_CODE: Record<string, string> = {
  CHC: "christchurch",
  AKL: "auckland",
  WLG: "wellington",
  ZQN: "queenstown",
  DUD: "dunedin",
  NRT: "tokyo",
  HND: "tokyo",
  KIX: "osaka",
  UKY: "kyoto",
  SYD: "sydney",
  MEL: "melbourne",
  BNE: "brisbane",
  SIN: "singapore",
  LHR: "london",
  LAX: "los angeles",
};

function normPlaceKey(place: string): string {
  const first = place.trim().split(",")[0]?.trim().toLowerCase() ?? "";
  return first.replace(/\s+/g, " ");
}

/** Best-effort metro key for an airport or city label. */
export function metroKeyForPlace(place: string): string {
  const trimmed = place.trim();
  if (!trimmed) return "";

  const code = airportCodeFromPlace(trimmed);
  if (METRO_BY_CODE[code]) return METRO_BY_CODE[code]!;

  const key = normPlaceKey(trimmed);
  if (CITY_IATA[key]) {
    const metro = METRO_BY_CODE[CITY_IATA[key]!];
    if (metro) return metro;
  }

  for (const [name, iata] of Object.entries(CITY_IATA)) {
    if (key.includes(name)) {
      const metro = METRO_BY_CODE[iata];
      if (metro) return metro;
    }
  }

  return key;
}

/** True when two places resolve to the same metro area (e.g. NRT and Tokyo). */
export function placesShareMetro(a: string, b: string): boolean {
  const ka = metroKeyForPlace(a);
  const kb = metroKeyForPlace(b);
  return Boolean(ka && kb && ka === kb);
}
