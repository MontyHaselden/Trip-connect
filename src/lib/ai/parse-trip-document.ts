import { z } from "zod";

import { ItineraryImportSchema } from "@/lib/ai/itinerary-import";
import { AI_TIME_NORMALIZATION_RULES } from "@/lib/ai/time-prompt";
import { prepareDocumentForAi } from "@/lib/documents/prepare-for-ai";
import { sanitizeItineraryTimes } from "@/lib/utils/ai-time";

export const TripFromDocumentSchema = z
  .object({
    name: z.string().min(2).max(200),
    schoolName: z.string().min(2).max(200),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().min(1).max(80),
    destinationCountry: z.string().nullable().optional(),
    destinationLanguage: z.string().nullable().optional(),
  })
  .merge(ItineraryImportSchema);

export type TripFromDocumentResult = z.infer<typeof TripFromDocumentSchema>;

export async function parseTripFromDocument(params: {
  text: string;
  defaultTimezone: string;
}): Promise<TripFromDocumentResult> {
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
- Infer trip name, school name, start/end dates, and timezone from the document when possible.
- If timezone is missing, use "${params.defaultTimezone}".
- Every day date must fall within startDate and endDate.
- ${AI_TIME_NORMALIZATION_RULES}
- Include all scheduled activities you can find; use empty items arrays for travel/rest days with no events.
- destinationCountry and destinationLanguage should reflect the trip destination when clear (e.g. "Japan", "Japanese"); otherwise null.
- Do not include markdown or commentary.`;

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
        { role: "user", content: trimmed },
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

  return sanitizeTripFromDocument(validated.data);
}

function sanitizeTripFromDocument(
  data: TripFromDocumentResult,
): TripFromDocumentResult {
  const sanitized = sanitizeItineraryTimes(data);
  const days = sanitized.days
    .filter((day) => day.date >= data.startDate && day.date <= data.endDate)
    .map((day) => ({
      ...day,
      items: day.items.filter((item) => item.title.trim().length > 0),
    }));

  if (data.startDate > data.endDate) {
    throw new Error("AI returned invalid trip dates.");
  }

  return { ...sanitized, days };
}
