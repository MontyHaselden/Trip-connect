import { z } from "zod";
import { DateTime } from "luxon";

import { completeOpenAiJson, parseOpenAiJsonContent } from "@/lib/ai/openai-json";
import {
  ambiguityReply,
  detectImportDateAmbiguity,
} from "@/lib/ai/detect-import-date-ambiguity";
import { prepareDocumentForAi } from "@/lib/documents/prepare-for-ai";

export type ImportChatTurn = {
  role: "user" | "assistant";
  text: string;
};

const AssessmentSchema = z.object({
  status: z.enum(["needs_clarification", "ready_to_import"]),
  assistantReply: z.string().min(1),
  importInstructions: z.string().nullable().optional(),
  inferredStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  inferredEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export type ImportReadinessResult = z.infer<typeof AssessmentSchema>;

function buildConversation(messages: ImportChatTurn[]): string {
  if (!messages.length) return "(no messages yet)";
  return messages
    .map((message) => `${message.role === "user" ? "Host" : "Assistant"}: ${message.text}`)
    .join("\n\n");
}

export async function assessImportReadiness(params: {
  documentText: string;
  messages: ImportChatTurn[];
  defaultTimezone: string;
  todayIso?: string;
}): Promise<ImportReadinessResult> {
  const prepared = prepareDocumentForAi(params.documentText);
  const today =
    params.todayIso ??
    DateTime.now().setZone(params.defaultTimezone).toISODate() ??
    new Date().toISOString().slice(0, 10);
  const currentYear = today.slice(0, 4);

  const localIssues = detectImportDateAmbiguity(
    [prepared, ...params.messages.map((message) => message.text)].join("\n\n"),
  );

  const onlyInitialTurn =
    params.messages.length <= 1 &&
    params.messages.every((message) => message.role === "user");

  if (localIssues.length > 0 && onlyInitialTurn) {
    return {
      status: "needs_clarification",
      assistantReply: ambiguityReply(localIssues),
      importInstructions: null,
      inferredStartDate: null,
      inferredEndDate: null,
    };
  }

  const system = `You help hosts import school trip itineraries. Decide whether there is enough date context to import safely.

Return ONLY JSON:
{"status":"needs_clarification"|"ready_to_import","assistantReply":"string","importInstructions":null|string,"inferredStartDate":null|"YYYY-MM-DD","inferredEndDate":null|"YYYY-MM-DD"}

Rules:
- status "needs_clarification" when year, month, or exact calendar dates are still ambiguous, contradictory, or relative (e.g. "this Tuesday", "next July") without a resolved ISO date.
- status "ready_to_import" only when you can state concrete start and end ISO dates and importInstructions the importer can follow.
- assistantReply: friendly, concise, plain language. Ask specific questions when confused. When ready, summarise the trip dates and tell the host they can press Import trip.
- importInstructions: when ready, one block merging host clarifications + resolved dates for the document importer (e.g. "Trip runs 16 Jul 2026 – 24 Jul 2026. Shift all booklet dates to 2026.").
- inferredStartDate / inferredEndDate: ISO dates when ready; otherwise null.
- Today is ${today} (${params.defaultTimezone}). Current year: ${currentYear}.
- If the host said a weekday + day + month, verify it is a real calendar date in the chosen year before marking ready.
- If the host attached a document and added a comment in the conversation (e.g. corrected dates), combine both when deciding readiness — the file is the itinerary, the comment is scheduling context.
- If the host asks what to do next, how to proceed, or similar while a document is loaded, explain clearly: clarify dates if still ambiguous, or tell them to press **Import trip** when dates are resolved. Do not tell them to re-paste the document.
- Do not ask whether you have the file if itinerary text is already present below.
- No markdown in JSON strings except **bold** in assistantReply is allowed.`;

  const user = `Conversation so far:
${buildConversation(params.messages)}

Itinerary / document text:
${prepared || "(empty — host may only be chatting)"}`;

  const content = await completeOpenAiJson({ system, user });
  const parsed = parseOpenAiJsonContent(content);
  const validated = AssessmentSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      status: "needs_clarification",
      assistantReply:
        "I couldn’t read the dates clearly yet. Please tell me the exact start and end dates (day, month, and year), e.g. 16 July 2026 – 24 July 2026.",
      importInstructions: null,
      inferredStartDate: null,
      inferredEndDate: null,
    };
  }

  return {
    ...validated.data,
    importInstructions: validated.data.importInstructions ?? null,
    inferredStartDate: validated.data.inferredStartDate ?? null,
    inferredEndDate: validated.data.inferredEndDate ?? null,
  };
}
