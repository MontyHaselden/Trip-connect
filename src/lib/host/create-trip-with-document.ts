import { normalizeImportInstructions } from "@/lib/documents/document-import-instructions";
import { extractTextFromUpload } from "@/lib/documents/extract-text";
import { importTripFromDocumentText } from "@/lib/host/import-trip-from-document";
import { createTripForHost } from "@/lib/host/trip-create";

export async function createTripWithOptionalDocument(params: {
  hostId: string;
  name: string;
  instructions?: string | null;
  file?: File | null;
  timezone?: string;
}) {
  const timezone = params.timezone?.trim() || "UTC";
  const trip = await createTripForHost({
    hostId: params.hostId,
    name: params.name.trim(),
    schoolName: "School trip",
    timezone,
    defaultCountryCallingCode: "NZ",
  });

  if (!params.file || params.file.size === 0) {
    return { trip, imported: false as const };
  }

  const documentText = await extractTextFromUpload(params.file);
  const instructions = normalizeImportInstructions(params.instructions);

  const result = await importTripFromDocumentText({
    tripId: trip.id,
    text: documentText,
    defaultTimezone: timezone,
    instructions,
    preserveTripName: params.name.trim(),
  });

  return { trip, imported: true as const, importResult: result };
}
