export function coerceAiTime(
  input: string | null | undefined,
  fallback = "09:00",
): string {
  if (!input?.trim()) return fallback;

  const raw = input.trim().toLowerCase();
  if (/^(morning|afternoon|evening|night|late evening|noon|midday)$/.test(raw)) {
    if (raw.includes("morning")) return "09:00";
    if (raw.includes("noon") || raw.includes("midday")) return "12:00";
    if (raw.includes("afternoon")) return "14:00";
    if (raw.includes("evening") || raw.includes("night")) return "18:00";
    return fallback;
  }

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return fallback;

  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const meridiem = match[3];

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  if (hour > 23 || Number(minute) > 59) return fallback;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

export function normalizeStoredTime(input: string): string {
  const coerced = coerceAiTime(input);
  if (/^\d{2}:\d{2}$/.test(coerced)) return `${coerced}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(coerced)) return coerced;
  throw new Error("Time must be HH:MM or HH:MM:SS");
}
