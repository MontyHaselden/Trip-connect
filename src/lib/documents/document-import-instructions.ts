const MAX_INSTRUCTIONS_LENGTH = 2000;

export function normalizeImportInstructions(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_INSTRUCTIONS_LENGTH);
}

export function buildDocumentImportUserMessage(params: {
  documentText: string;
  instructions?: string | null;
}): string {
  const instructions = normalizeImportInstructions(params.instructions);
  const parts: string[] = [];
  if (instructions) {
    parts.push(`Host instructions (follow these carefully):\n${instructions}`);
  }
  parts.push(`Document text:\n${params.documentText}`);
  return parts.join("\n\n");
}

export function documentImportSystemRules(params: {
  defaultTimezone: string;
  currentYear?: number;
}): string {
  const year = params.currentYear ?? new Date().getFullYear();
  return `- The source may be a scanned booklet or PDF with photos, captions, page numbers, and appendix pages. Ignore decorative content and extract only the real schedule.
- Skip photo captions, image placeholders, student booklet sections (contacts, emergency card, phrases, room lists), and repeated headers/footers.
- Airport layovers and connection hubs are not destinations. If passengers change planes but do not leave the airport (typical layover under one day with no hotel), do not list that hub as a day location — keep them in transit on the flight legs only.
- Never output hotel check-in or check-out as scheduled activities or timeline items. Lines like "Check in:" or "Check out:" in the document only inform accommodation stay date ranges (structure)—the app builds the schedule from stays, transport, and real activities separately.
- If the host asks to move dates to a new year (e.g. "this year", "${year}"), shift every itinerary date to that year while keeping the same month and day. Update startDate and endDate to match.
- If timezone is missing, use "${params.defaultTimezone}".
- Current calendar year for reference: ${year}.`;
}
