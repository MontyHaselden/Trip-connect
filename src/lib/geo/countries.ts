import countriesJson from "./countries.json";

export type Country = {
  code: string;
  name: string;
};

export const COUNTRIES: Country[] = countriesJson as Country[];

const byNameLower = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));
const byCodeLower = new Map(COUNTRIES.map((c) => [c.code.toLowerCase(), c]));

export function searchCountries(query: string, limit = 12): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES.slice(0, limit);
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
  ).slice(0, limit);
}

export function countryNameToCode(name: string): string | null {
  return byNameLower.get(name.trim().toLowerCase())?.code ?? null;
}

export function countryCodeToName(code: string): string | null {
  return byCodeLower.get(code.trim().toLowerCase())?.name ?? null;
}

export function codesForCountryNames(names: string[]): string[] {
  return names
    .map(countryNameToCode)
    .filter((c): c is string => Boolean(c));
}
