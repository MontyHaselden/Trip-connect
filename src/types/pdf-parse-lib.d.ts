declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = { text: string; numpages?: number; numrender?: number };

  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
