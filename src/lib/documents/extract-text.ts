const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 100_000;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function capText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH);
}

export async function extractTextFromUpload(file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large (max 5 MB).");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      text = parsed.text ?? "";
    } finally {
      await parser.destroy();
    }
  } else if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const parsed = await mammoth.extractRawText({ buffer });
    text = parsed.value ?? "";
  } else if (
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv") ||
    name.endsWith(".rtf") ||
    file.type.startsWith("text/")
  ) {
    text = buffer.toString("utf8");
  } else {
    throw new Error(
      "Unsupported file type. Upload a PDF, Word document (.docx), or text file.",
    );
  }

  const cleaned = capText(normalizeWhitespace(text));
  if (cleaned.length < 50) {
    throw new Error(
      "Could not read enough text from the document. Try a text-based PDF or paste into the itinerary import after creating the trip.",
    );
  }

  return cleaned;
}
