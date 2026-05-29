const WORD_HOURS: Record<string, number> = {
  noon: 12,
  midday: 12,
  midnight: 0,
};

function stripTimeNoise(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^(at|from|around|about|approx(?:imately)?|~)\s+/i, "")
    .replace(/\s+(o'?clock)\b/g, "")
    .trim();
}

function parseMeridiemHour(
  hour: number,
  meridiem: string | undefined,
): number | null {
  if (hour < 0 || hour > 23) return null;
  if (!meridiem) return hour;

  if (meridiem === "pm" && hour < 12) return hour + 12;
  if (meridiem === "am" && hour === 12) return 0;
  if (meridiem === "am" || meridiem === "pm") return hour;
  return null;
}

function formatHourMinute(hour: number, minute: number): string | null {
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseNumericTime(raw: string): string | null {
  const compact = raw.replace(/[^\d]/g, "");
  if (/^\d{3,4}$/.test(compact)) {
    const hour = Number(compact.slice(0, compact.length - 2));
    const minute = Number(compact.slice(-2));
    return formatHourMinute(hour, minute);
  }
  return null;
}

function parseFlexibleClock(raw: string): string | null {
  const normalized = raw.replace(/\./g, ":").replace(/-/g, ":");

  const colonMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (colonMatch) {
    const hour = parseMeridiemHour(Number(colonMatch[1]), colonMatch[4]);
    if (hour === null) return null;
    return formatHourMinute(hour, Number(colonMatch[2]));
  }

  const spacedMatch = normalized.match(/^(\d{1,2})\s+(\d{2})\s*(am|pm)?$/);
  if (spacedMatch) {
    const hour = parseMeridiemHour(Number(spacedMatch[1]), spacedMatch[3]);
    if (hour === null) return null;
    return formatHourMinute(hour, Number(spacedMatch[2]));
  }

  const hourOnlyMatch = normalized.match(/^(\d{1,2})\s*(am|pm)$/);
  if (hourOnlyMatch) {
    const hour = parseMeridiemHour(Number(hourOnlyMatch[1]), hourOnlyMatch[2]);
    if (hour === null) return null;
    return formatHourMinute(hour, 0);
  }

  return parseNumericTime(normalized);
}

function parsePhraseTime(raw: string): string | null {
  const inTheMatch = raw.match(
    /^(\d{1,2})(?::(\d{2}))?\s+in\s+the\s+(morning|afternoon|evening|night)$/,
  );
  if (inTheMatch) {
    let hour = Number(inTheMatch[1]);
    const minute = inTheMatch[2] ? Number(inTheMatch[2]) : 0;
    const part = inTheMatch[3];
    if (part === "afternoon" && hour < 12) hour += 12;
    if (part === "evening" || part === "night") {
      if (hour < 12) hour += 12;
    }
    return formatHourMinute(hour, minute);
  }

  const plainPartMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s+(morning|afternoon|evening|night)$/);
  if (plainPartMatch) {
    let hour = Number(plainPartMatch[1]);
    const minute = plainPartMatch[2] ? Number(plainPartMatch[2]) : 0;
    const part = plainPartMatch[3];
    if (part === "afternoon" && hour < 12) hour += 12;
    if ((part === "evening" || part === "night") && hour < 12) hour += 12;
    return formatHourMinute(hour, minute);
  }

  if (raw.includes("half past")) {
    const halfPast = raw.match(/half past\s+(\d{1,2})(?:\s*(am|pm))?/);
    if (halfPast) {
      const hour = parseMeridiemHour(Number(halfPast[1]), halfPast[2]);
      if (hour === null) return null;
      return formatHourMinute(hour, 30);
    }
  }

  if (raw.includes("quarter past")) {
    const quarterPast = raw.match(/quarter past\s+(\d{1,2})(?:\s*(am|pm))?/);
    if (quarterPast) {
      const hour = parseMeridiemHour(Number(quarterPast[1]), quarterPast[2]);
      if (hour === null) return null;
      return formatHourMinute(hour, 15);
    }
  }

  if (raw.includes("quarter to")) {
    const quarterTo = raw.match(/quarter to\s+(\d{1,2})(?:\s*(am|pm))?/);
    if (quarterTo) {
      let hour = Number(quarterTo[1]) - 1;
      const meridiem = quarterTo[2];
      if (meridiem === "pm" && hour < 12) hour += 12;
      if (meridiem === "am" && hour === 11) hour = 23;
      if (hour < 0) hour = 23;
      return formatHourMinute(hour, 45);
    }
  }

  for (const [word, hour] of Object.entries(WORD_HOURS)) {
    if (raw === word || raw.includes(word)) {
      return formatHourMinute(hour, 0);
    }
  }

  if (/^(morning|early morning)$/.test(raw)) return "09:00";
  if (/^(afternoon)$/.test(raw)) return "14:00";
  if (/^(evening|late evening|night)$/.test(raw)) return "18:00";

  return null;
}

export function coerceAiTime(
  input: string | null | undefined,
  fallback = "09:00",
): string {
  if (!input?.trim()) return fallback;

  const raw = stripTimeNoise(input);
  if (!raw) return fallback;

  const parsed = parseFlexibleClock(raw) ?? parsePhraseTime(raw);
  if (parsed) return parsed;

  return fallback;
}

export function normalizeStoredTime(input: string, fallback = "09:00"): string {
  const coerced = coerceAiTime(input, fallback);
  if (/^\d{2}:\d{2}$/.test(coerced)) return `${coerced}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(coerced)) return coerced;
  return `${fallback}:00`;
}

export function sanitizeItineraryTimes<
  T extends {
    days: Array<{
      items: Array<{
        startTime: string;
        endTime?: string | null;
        leaveByTime?: string | null;
      }>;
    }>;
  },
>(data: T): T {
  return {
    ...data,
    days: data.days.map((day) => ({
      ...day,
      items: day.items.map((item) => ({
        ...item,
        startTime: coerceAiTime(item.startTime),
        endTime: item.endTime ? coerceAiTime(item.endTime) : null,
        leaveByTime: item.leaveByTime ? coerceAiTime(item.leaveByTime) : null,
      })),
    })),
  };
}
