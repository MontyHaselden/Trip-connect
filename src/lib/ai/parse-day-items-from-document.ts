import { z } from "zod";

import { completeOpenAiJson, parseOpenAiJsonContent } from "@/lib/ai/openai-json";
import { ImportItemSchema } from "@/lib/ai/itinerary-import-schemas";
import { AI_TIME_NORMALIZATION_RULES } from "@/lib/ai/time-prompt";
import {
  buildDocumentImportUserMessage,
  documentImportSystemRules,
} from "@/lib/documents/document-import-instructions";
import { prepareDocumentForAi } from "@/lib/documents/prepare-for-ai";
import { ACTIVITY_CATEGORIES } from "@/types/activity-category";
import { sanitizeItineraryTimes } from "@/lib/utils/ai-time";

const DayItemsSchema = z.object({
  items: z.array(ImportItemSchema),
});

const CATEGORY_LIST = ACTIVITY_CATEGORIES.join(", ");

export async function parseDayItemsFromDocument(params: {
  text: string;
  date: string;
  cityLabel: string;
  defaultTimezone: string;
  startDate: string;
  endDate: string;
  instructions?: string | null;
}) {
  const trimmed = prepareDocumentForAi(params.text);

  const system = `You extract scheduled activities for ONE day of a school trip into JSON.

Return ONLY valid JSON with this shape:
{"items":[{"startTime":"HH:MM","endTime":null,"title":"string","locationName":null,"address":null,"leaveByTime":null,"transportNote":null,"bringNote":null,"category":null}]}

Rules:
- Extract ONLY activities for ${params.date} (${params.cityLabel}).
- Trip runs ${params.startDate} to ${params.endDate}. Timezone context: ${params.defaultTimezone}.
- ${documentImportSystemRules({ defaultTimezone: params.defaultTimezone })}
- ${AI_TIME_NORMALIZATION_RULES}
- For each item, set category to one of: ${CATEGORY_LIST}. Use null only if truly unclear.
- Use an empty items array if the day has no scheduled events.
- Do not include markdown or commentary.`;

  const userContent = `${buildDocumentImportUserMessage({
    documentText: trimmed,
    instructions: params.instructions,
  })}

Target day (extract only this date):
${params.date} — ${params.cityLabel}`;

  const content = await completeOpenAiJson({ system, user: userContent });
  const parsed = parseOpenAiJsonContent(content);
  const validated = DayItemsSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`AI could not read activities for ${params.date}.`);
  }

  const sanitized = sanitizeItineraryTimes({ days: [{ date: params.date, cityLabel: params.cityLabel, items: validated.data.items }] });
  return sanitized.days[0]?.items.filter((item) => item.title.trim().length > 0) ?? [];
}
