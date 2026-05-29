import { z } from "zod";

import { AI_TIME_NORMALIZATION_RULES } from "@/lib/ai/time-prompt";
import { sanitizeItineraryTimes } from "@/lib/utils/ai-time";

const ImportItemSchema = z.object({
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  title: z.string().min(1),
  locationName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  leaveByTime: z.string().nullable().optional(),
  transportNote: z.string().nullable().optional(),
  bringNote: z.string().nullable().optional(),
});

const ImportDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cityLabel: z.string().min(1),
  summary: z.string().nullable().optional(),
  items: z.array(ImportItemSchema),
});

export const ItineraryImportSchema = z.object({
  days: z.array(ImportDaySchema),
});

export type ItineraryImportResult = z.infer<typeof ItineraryImportSchema>;

export type TripContext = {
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
  destinationCountry: string | null;
  destinationLanguage: string | null;
};

const MAX_TEXT_LENGTH = 12_000;

export async function parseItineraryText(params: {
  text: string;
  trip: TripContext;
}): Promise<ItineraryImportResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const trimmed = params.text.trim();
  if (trimmed.length < 20) {
    throw new Error("Paste more itinerary text to import.");
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text is too long (max ${MAX_TEXT_LENGTH} characters).`);
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const system = `You extract school trip itineraries into JSON. Trip: ${params.trip.name}. Dates: ${params.trip.startDate} to ${params.trip.endDate}. Timezone: ${params.trip.timezone}. Destination: ${params.trip.destinationCountry ?? "unknown"} (${params.trip.destinationLanguage ?? ""}).

Return ONLY valid JSON with this shape:
{"days":[{"date":"YYYY-MM-DD","cityLabel":"string","summary":null,"items":[{"startTime":"HH:MM","endTime":null,"title":"string","locationName":null,"address":null,"leaveByTime":null,"transportNote":null,"bringNote":null}]}]}

Rules:
- Every day date must be within the trip date range.
- ${AI_TIME_NORMALIZATION_RULES}
- If a day has no items, use an empty items array.
- Omit fields you cannot infer (use null).
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

  const validated = ItineraryImportSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("AI response did not match the expected itinerary format.");
  }

  for (const day of validated.data.days) {
    if (day.date < params.trip.startDate || day.date > params.trip.endDate) {
      throw new Error(`Date ${day.date} is outside the trip range.`);
    }
  }

  return sanitizeItineraryTimes(validated.data);
}
