import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export function normalizeToE164(input: string, defaultCountry: string): string {
  const trimmed = input.trim();
  const region = defaultCountry.toUpperCase() as CountryCode;
  const parsed =
    trimmed.startsWith("+")
      ? parsePhoneNumberFromString(trimmed)
      : parsePhoneNumberFromString(trimmed, region);

  if (!parsed || !parsed.isValid()) {
    throw new Error("Please enter a valid phone number.");
  }

  return parsed.number; // E.164
}

