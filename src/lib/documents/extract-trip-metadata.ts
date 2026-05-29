import { prepareDocumentForAi } from "@/lib/documents/prepare-for-ai";

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function padDay(day: string): string {
  return day.padStart(2, "0");
}

function defaultDates(): { startDate: string; endDate: string } {
  const start = new Date();
  start.setDate(start.getDate() + 30);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function extractTripMetadataQuick(
  text: string,
  defaultTimezone: string,
): {
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  timezone: string;
} {
  const prepared = prepareDocumentForAi(text);
  const fallback = defaultDates();

  let name = "Imported trip";
  const titleMatch =
    text.match(/^##\s+(.+)$/m) ??
    text.match(/^#\s+(.+)$/m) ??
    prepared.match(/([A-Z][A-Za-z\s'-]{3,60}(?:Trip|Tour|Exchange|Visit))/);
  if (titleMatch?.[1]) {
    name = titleMatch[1].replace(/\*\*/g, "").trim();
  }

  let schoolName = "School trip";
  const schoolMatch =
    prepared.match(/([A-Z][A-Za-z\s'-]{2,50}\sSchool)/) ??
    prepared.match(/School:\s*([^|]+)/i);
  if (schoolMatch?.[1]) {
    schoolName = schoolMatch[1].trim();
  }

  const rangeMatch = prepared.match(
    /(\d{1,2})\s*[–-]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );
  if (rangeMatch) {
    const month = MONTHS[rangeMatch[3].toLowerCase()];
    if (month) {
      return {
        name,
        schoolName,
        startDate: `${rangeMatch[4]}-${month}-${padDay(rangeMatch[1])}`,
        endDate: `${rangeMatch[4]}-${month}-${padDay(rangeMatch[2])}`,
        timezone: defaultTimezone,
      };
    }
  }

  const isoRangeMatch = prepared.match(
    /(\d{4}-\d{2}-\d{2})\s*[–-]\s*(\d{4}-\d{2}-\d{2})/,
  );
  if (isoRangeMatch) {
    return {
      name,
      schoolName,
      startDate: isoRangeMatch[1],
      endDate: isoRangeMatch[2],
      timezone: defaultTimezone,
    };
  }

  return {
    name,
    schoolName,
    startDate: fallback.startDate,
    endDate: fallback.endDate,
    timezone: defaultTimezone,
  };
}
