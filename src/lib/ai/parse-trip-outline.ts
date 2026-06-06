import { z } from "zod";

import { completeOpenAiJson, parseOpenAiJsonContent } from "@/lib/ai/openai-json";
import {
  buildDocumentImportUserMessage,
  documentImportSystemRules,
} from "@/lib/documents/document-import-instructions";
import { prepareDocumentForAi } from "@/lib/documents/prepare-for-ai";

const TripOutlineDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cityLabel: z.string().min(1),
  summary: z.string().nullable().optional(),
});

const TripOutlineSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  schoolName: z.string().max(200).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(80).optional(),
  destinationCountry: z.string().nullable().optional(),
  destinationLanguage: z.string().nullable().optional(),
  days: z.array(TripOutlineDaySchema).min(1),
});

export type TripOutlineDay = z.infer<typeof TripOutlineDaySchema>;

export type TripOutlineResult = {
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  timezone: string;
  destinationCountry: string | null;
  destinationLanguage: string | null;
  days: TripOutlineDay[];
};

export async function parseTripOutlineFromDocument(params: {
  text: string;
  defaultTimezone: string;
  instructions?: string | null;
}): Promise<TripOutlineResult> {
  const trimmed = prepareDocumentForAi(params.text);
  if (trimmed.length < 50) {
    throw new Error("The document did not contain enough itinerary text.");
  }

  const system = `You plan school trip structure from documents into JSON.

Return ONLY valid JSON with this shape:
{"name":"string","schoolName":"string","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","timezone":"IANA/Timezone","destinationCountry":null,"destinationLanguage":null,"days":[{"date":"YYYY-MM-DD","cityLabel":"string","summary":null}]}

Rules:
- First decide the full trip duration: startDate, endDate, and every calendar day in the trip.
- List one entry per day in chronological order. Include travel/rest days with a cityLabel even if no activities yet.
- Do NOT include activity items — only day dates, city labels, and optional summaries.
- Infer school name, timezone, destination country, and destination language when possible.
- Every day date must fall within startDate and endDate.
- ${documentImportSystemRules({ defaultTimezone: params.defaultTimezone })}
- Do not include markdown or commentary.`;

  const userContent = buildDocumentImportUserMessage({
    documentText: trimmed,
    instructions: params.instructions,
  });

  const content = await completeOpenAiJson({ system, user: userContent });
  const parsed = parseOpenAiJsonContent(content);
  const validated = TripOutlineSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      "AI could not read the trip dates from that document. Try clearer instructions or a shorter section.",
    );
  }

  const data = validated.data;
  if (data.endDate < data.startDate) {
    throw new Error("AI returned invalid trip dates.");
  }

  const days = data.days
    .filter((day) => day.date >= data.startDate && day.date <= data.endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!days.length) {
    throw new Error("AI could not find any trip days in that document.");
  }

  return {
    name: data.name?.trim() || "Imported trip",
    schoolName: data.schoolName?.trim() || "School trip",
    startDate: data.startDate,
    endDate: data.endDate,
    timezone: data.timezone?.trim() || params.defaultTimezone,
    destinationCountry: data.destinationCountry ?? null,
    destinationLanguage: data.destinationLanguage ?? null,
    days,
  };
}
