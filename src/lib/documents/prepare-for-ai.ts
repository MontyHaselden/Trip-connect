const MAX_TEXT_LENGTH = 50_000;

const APPENDIX_MARKERS = [
  "# Example My Trip Content",
  "# Key Contacts",
  "# Emergency Card",
  "# Emergency Phrases",
  "## My details",
  "## My room",
];

export function prepareDocumentForAi(text: string): string {
  let prepared = text.replace(/\s+/g, " ").trim();

  for (const marker of APPENDIX_MARKERS) {
    const idx = prepared.indexOf(marker);
    if (idx > 0) {
      prepared = prepared.slice(0, idx).trim();
      break;
    }
  }

  if (prepared.length > MAX_TEXT_LENGTH) {
    prepared = prepared.slice(0, MAX_TEXT_LENGTH).trim();
  }

  return prepared;
}
