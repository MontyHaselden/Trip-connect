import { configurePdfJsForServer } from "./configure-pdfjs-server";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 100_000;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function capText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH);
}

async function extractPdfTextWithPdfJs(buffer: Buffer): Promise<string> {
  await configurePdfJsForServer();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;
  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    parts.push(
      content.items
        .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
        .join(" "),
    );
  }
  return parts.join("\n");
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Import the parser directly — pdf-parse/index.js runs a debug read of
    // ./test/data/05-versions-space.pdf when module.parent is unset (Next/Vercel).
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
      data: Buffer,
    ) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim() ?? "";
    if (text.length >= 50) return text;
  } catch {
    // Some ReportLab PDFs have xref tables pdf-parse cannot read — fall back below.
  }
  return extractPdfTextWithPdfJs(buffer);
}

export async function extractTextFromUpload(
  file: File,
  options?: { minTextLength?: number },
): Promise<string> {
  const minTextLength = options?.minTextLength ?? 50;
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large (max 5 MB).");
  }

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  let text = "";

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    text = await extractPdfText(buffer);
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

  const cleaned = capText(
    name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv") ||
      name.endsWith(".rtf") ||
      file.type.startsWith("text/")
      ? text.replace(/\r\n/g, "\n").trim()
      : normalizeWhitespace(text),
  );
  if (cleaned.length < minTextLength) {
    throw new Error(
      "Could not read enough text from this PDF (it may be mostly photos). Try exporting a text version, or paste the schedule in the AI editor.",
    );
  }

  return cleaned;
}
