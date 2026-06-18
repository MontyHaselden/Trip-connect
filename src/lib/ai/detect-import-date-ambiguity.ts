const MONTH_NAMES =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i;

const WEEKDAY_ORDINAL =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi;

const ORDINAL_DAY = /\b\d{1,2}(?:st|nd|rd|th)\b/gi;

const ISO_DATE = /\b20\d{2}-\d{2}-\d{2}\b/;

const YEAR = /\b(20\d{2})\b/;

export type ImportDateAmbiguity = {
  code: "missing_year" | "missing_month" | "relative_dates" | "day_week_mismatch";
  detail: string;
};

export function detectImportDateAmbiguity(text: string): ImportDateAmbiguity[] {
  const combined = text.trim();
  if (!combined || combined.length < 20) return [];

  const issues: ImportDateAmbiguity[] = [];
  const hasYear = YEAR.test(combined) || ISO_DATE.test(combined);
  const hasMonth = MONTH_NAMES.test(combined);
  const weekdayOrdinalMatches = [...combined.matchAll(WEEKDAY_ORDINAL)];
  const ordinalMatches = [...combined.matchAll(ORDINAL_DAY)];

  if ((weekdayOrdinalMatches.length > 0 || ordinalMatches.length >= 3) && !hasYear) {
    issues.push({
      code: "missing_year",
      detail: "The itinerary lists specific days but no year (e.g. 2026).",
    });
  }

  if (weekdayOrdinalMatches.length > 0 && !hasMonth) {
    issues.push({
      code: "missing_month",
      detail: "Days like “Tuesday 16th” appear without a clear month.",
    });
  }

  if (/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(combined)) {
    issues.push({
      code: "relative_dates",
      detail: "The text uses relative dates like “this Tuesday” — I need an exact calendar date.",
    });
  }

  return issues;
}

export function ambiguityReply(issues: ImportDateAmbiguity[]): string {
  if (!issues.length) {
    return "";
  }

  const lines = issues.map((issue) => `· ${issue.detail}`);
  const hints: string[] = [];

  if (issues.some((issue) => issue.code === "missing_year")) {
    hints.push("Which **year** is this trip?");
  }
  if (issues.some((issue) => issue.code === "missing_month")) {
    hints.push("Which **month** should I use?");
  }
  if (issues.some((issue) => issue.code === "relative_dates")) {
    hints.push("Give the exact start date, e.g. **16 July 2026**.");
  }

  return [
    "I’m not ready to import yet — the dates aren’t fully defined:",
    "",
    ...lines,
    "",
    hints.length ? `Please tell me: ${hints.join(" ")}` : "Please clarify the trip dates, then I’ll build the calendar.",
  ].join("\n");
}
