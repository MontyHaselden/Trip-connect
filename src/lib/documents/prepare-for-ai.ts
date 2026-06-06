const MAX_TEXT_LENGTH = 50_000;

const APPENDIX_MARKERS = [
  "# Example My Trip Content",
  "# Key Contacts",
  "# Emergency Card",
  "# Emergency Phrases",
  "## My details",
  "## My room",
  "Key Contacts",
  "Emergency Card",
  "Emergency Phrases",
  "Photo gallery",
  "Student photos",
];

/** Strip common PDF/booklet noise before sending text to the model. */
function stripDocumentNoise(text: string): string {
  return text
    .replace(/\[(?:image|photo|picture|fig(?:ure)?\.?\s*\d*)\]/gi, " ")
    .replace(/\bpage\s+\d+\s+of\s+\d+\b/gi, " ")
    .replace(/\b(?:photo|image)\s*:\s*[^.]{0,80}\./gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function prepareDocumentForAi(text: string): string {
  let prepared = stripDocumentNoise(text);

  for (const marker of APPENDIX_MARKERS) {
    const idx = prepared.toLowerCase().indexOf(marker.toLowerCase());
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
