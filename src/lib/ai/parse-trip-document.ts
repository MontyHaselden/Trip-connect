import { z } from "zod";

import { ItineraryImportSchema } from "@/lib/ai/itinerary-import";
import { AI_TIME_NORMALIZATION_RULES } from "@/lib/ai/time-prompt";
import {
  buildDocumentImportUserMessage,
  documentImportSystemRules,
} from "@/lib/documents/document-import-instructions";
import { prepareDocumentForAi } from "@/lib/documents/prepare-for-ai";
import { sanitizeItineraryTimes } from "@/lib/utils/ai-time";

export const TripFromDocumentSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    schoolName: z.string().max(200).nullable().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    timezone: z.string().min(1).max(80).optional(),
    destinationCountry: z.string().nullable().optional(),
    destinationLanguage: z.string().nullable().optional(),
  })
  .merge(ItineraryImportSchema);

export type TripFromDocumentResult = z.infer<typeof TripFromDocumentSchema>;

export type ResolvedTripFromDocument = TripFromDocumentResult & {
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  timezone: string;
};

export async function parseTripFromDocument(params: {
  text: string;
  defaultTimezone: string;
  instructions?: string | null;
}): Promise<ResolvedTripFromDocument> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const trimmed = prepareDocumentForAi(params.text);
  if (trimmed.length < 50) {
    throw new Error("The document did not contain enough itinerary text.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const system = `You extract school trip details from documents into JSON.

Return ONLY valid JSON with this shape:
{"name":"string","schoolName":"string","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","timezone":"IANA/Timezone","destinationCountry":null,"destinationLanguage":null,"days":[{"date":"YYYY-MM-DD","cityLabel":"string","summary":null,"items":[{"startTime":"HH:MM","endTime":null,"title":"string","locationName":null,"address":null,"leaveByTime":null,"transportNote":null,"bringNote":null}]}]}

Rules:
- Infer school name, start/end dates, timezone, destination country, and destination language from the document when possible.
- Do not override the trip name from host context unless the document clearly contains a better official trip title.
- Every day date must fall within startDate and endDate.
- ${documentImportSystemRules({ defaultTimezone: params.defaultTimezone })}
- ${AI_TIME_NORMALIZATION_RULES}
- Include all scheduled activities you can find; use empty items arrays for travel/rest days with no events.
- destinationCountry and destinationLanguage should reflect the trip destination when clear (e.g. "Japan", "ja"); otherwise null.
- Do not include markdown or commentary.`;

  const userContent = buildDocumentImportUserMessage({
    documentText: trimmed,
    instructions: params.instructions,
  });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Could not parse AI response as JSON.");
  }

  const validated = TripFromDocumentSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      "AI could not read the trip details from that document. Try a shorter itinerary section or create the trip manually first.",
    );
  }

  return sanitizeTripFromDocument(validated.data, {
    timezone: params.defaultTimezone,
  });
}

function sanitizeTripFromDocument(
  data: TripFromDocumentResult,
  defaults: { timezone: string },
): ResolvedTripFromDocument {
  const sanitized = sanitizeItineraryTimes(data);
  const days = sanitized.days
    .map((day) => ({
      ...day,
      items: day.items.filter((item) => item.title.trim().length > 0),
    }))
    .filter((day) => day.items.length > 0 || day.cityLabel.trim().length > 0);

  if (!days.length) {
    throw new Error(
      "AI could not find scheduled activities in that document. Try adding clearer instructions or paste the itinerary text in the builder.",
    );
  }

  const sortedDates = days.map((d) => d.date).sort();
  const startDate = data.startDate ?? sortedDates[0]!;
  const endDate = data.endDate ?? sortedDates[sortedDates.length - 1]!;

  if (endDate < startDate) {
    throw new Error("AI returned invalid trip dates.");
  }

  const inRange = days.filter(
    (day) => day.date >= startDate && day.date <= endDate,
  );

  const resolved: ResolvedTripFromDocument = {
    ...sanitized,
    name: data.name?.trim() || "Imported trip",
    schoolName: data.schoolName?.trim() || "School trip",
    startDate,
    endDate,
    timezone: data.timezone?.trim() || defaults.timezone,
    days: inRange.length > 0 ? inRange : days,
  };
  return resolved;
}
