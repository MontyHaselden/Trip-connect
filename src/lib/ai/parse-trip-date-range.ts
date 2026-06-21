const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferYear(month: number, referenceIso: string, explicitYear: number | null): number {
  if (explicitYear) return explicitYear;
  const refYear = Number.parseInt(referenceIso.slice(0, 4), 10);
  const refMonth = Number.parseInt(referenceIso.slice(5, 7), 10);
  if (month < refMonth - 6) return refYear + 1;
  if (month > refMonth + 6) return refYear - 1;
  return refYear;
}

function monthFromToken(token: string): number | undefined {
  return MONTHS[token.toLowerCase()];
}

function monthPattern(): string {
  return Object.keys(MONTHS).join("|");
}

export function parseMonthShiftFromMessage(message: string): number | null {
  const lower = message.toLowerCase();
  if (/\b(one|1|a)\s+month\b/.test(lower) && /\b(back|earlier|sooner)\b/.test(lower)) {
    return -1;
  }
  if (/\b(one|1|a)\s+month\b/.test(lower) && /\b(forward|later)\b/.test(lower)) {
    return 1;
  }
  const back = lower.match(/\b(?:move|shift)\s+(?:everything\s+)?(?:back|earlier)\s+by\s+(\d+)\s+months?\b/);
  if (back) return -Number.parseInt(back[1]!, 10);
  const backAlt = lower.match(/\b(?:move|shift)\s+back\s+(\d+)\s+months?\b/);
  if (backAlt) return -Number.parseInt(backAlt[1]!, 10);
  const forward = lower.match(/\b(?:move|shift)\s+(?:forward|later)\s+by\s+(\d+)\s+months?\b/);
  if (forward) return Number.parseInt(forward[1]!, 10);
  return null;
}

export function parseDayMonthRangeFromMessage(
  message: string,
  referenceStart: string,
): { startDate: string; endDate: string } | null {
  const explicitYearMatch = message.match(/\b(20\d{2})\b/);
  const explicitYear = explicitYearMatch ? Number.parseInt(explicitYearMatch[1]!, 10) : null;

  const isoRange = message.match(
    /\b(20\d{2}-\d{2}-\d{2})\s*(?:to|through|until|-)\s*(20\d{2}-\d{2}-\d{2})\b/i,
  );
  if (isoRange) {
    const startDate = isoRange[1]!;
    const endDate = isoRange[2]!;
    return endDate >= startDate ? { startDate, endDate } : null;
  }

  const crossMonth = message.match(
    new RegExp(
      `(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthPattern()})\\s*(?:to|through|until|-)\\s*(?:the\\s*)?(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthPattern()})\\b`,
      "i",
    ),
  );
  if (crossMonth) {
    const startDay = Number.parseInt(crossMonth[1]!, 10);
    const startMonth = monthFromToken(crossMonth[2]!);
    const endDay = Number.parseInt(crossMonth[3]!, 10);
    const endMonth = monthFromToken(crossMonth[4]!);
    if (!startMonth || !endMonth || startDay < 1 || endDay < 1) return null;

    const refYear = explicitYear ?? Number.parseInt(referenceStart.slice(0, 4), 10);
    let startYear = refYear;
    let endYear = refYear;
    if (endMonth < startMonth) endYear += 1;

    const startDate = isoDate(startYear, startMonth, startDay);
    const endDate = isoDate(endYear, endMonth, endDay);
    return endDate >= startDate ? { startDate, endDate } : null;
  }

  const rangeRe = new RegExp(
    `(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|through|until|-)\\s*(?:the\\s*)?(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthPattern()})\\b`,
    "i",
  );
  const match = message.match(rangeRe);
  if (!match) return null;

  const startDay = Number.parseInt(match[1]!, 10);
  const endDay = Number.parseInt(match[2]!, 10);
  const month = monthFromToken(match[3]!);
  if (!month || startDay < 1 || endDay < 1 || endDay < startDay) return null;

  const year = inferYear(month, referenceStart, explicitYear);
  const startDate = isoDate(year, month, startDay);
  const endDate = isoDate(year, month, endDay);
  return { startDate, endDate };
}

export function looksLikeTripChangeConversation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /\b(change|move|shift|correct|actually|supposed|remove|trim|drop|extend|fill|add|update|july|august|september|october|dates?|trip|calendar)\b/i.test(
    trimmed,
  );
}
