import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { tripAssistantSessions } from "@/lib/db/schema";
import type { TripCommand } from "@/lib/trip-engine/commands";

const StoredMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  fullText: z.string().optional(),
  attachedFileName: z.string().optional(),
  readyToImport: z.boolean().optional(),
  importInstructions: z.string().nullable().optional(),
  proposedCommands: z.array(z.record(z.string(), z.unknown())).optional(),
  commandSummaries: z.array(z.string()).optional(),
  applied: z.boolean().optional(),
});

export type StoredAssistantMessage = z.infer<typeof StoredMessageSchema> & {
  proposedCommands?: TripCommand[];
};

const SessionSchema = z.object({
  messages: z.array(StoredMessageSchema).max(80),
  sourceText: z.string().max(50_000).optional(),
});

export type AssistantChatSession = {
  messages: StoredAssistantMessage[];
  sourceText: string;
};

export async function loadAssistantChatSession(
  tripId: string,
): Promise<AssistantChatSession | null> {
  try {
    const [row] = await db
      .select({
        messagesJson: tripAssistantSessions.messagesJson,
        sourceText: tripAssistantSessions.sourceText,
      })
      .from(tripAssistantSessions)
      .where(eq(tripAssistantSessions.tripId, tripId))
      .limit(1);

    if (!row) return null;

    const parsed = SessionSchema.safeParse({
      messages: row.messagesJson ?? [],
      sourceText: row.sourceText ?? "",
    });
    if (!parsed.success) return null;

    return {
      messages: parsed.data.messages as StoredAssistantMessage[],
      sourceText: parsed.data.sourceText ?? "",
    };
  } catch (err) {
    if (isMissingAssistantSessionsTable(err)) return null;
    throw err;
  }
}

function isMissingAssistantSessionsTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /trip_assistant_sessions/i.test(msg) && /does not exist|relation/i.test(msg);
}

export async function saveAssistantChatSession(
  tripId: string,
  session: AssistantChatSession,
): Promise<void> {
  const parsed = SessionSchema.parse({
    messages: session.messages,
    sourceText: session.sourceText,
  });

  try {
    await db
      .insert(tripAssistantSessions)
      .values({
        tripId,
        messagesJson: parsed.messages,
        sourceText: parsed.sourceText || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tripAssistantSessions.tripId,
        set: {
          messagesJson: parsed.messages,
          sourceText: parsed.sourceText || null,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    if (isMissingAssistantSessionsTable(err)) return;
    throw err;
  }
}

export async function clearAssistantChatSession(tripId: string): Promise<void> {
  try {
    await db.delete(tripAssistantSessions).where(eq(tripAssistantSessions.tripId, tripId));
  } catch (err) {
    if (isMissingAssistantSessionsTable(err)) return;
    throw err;
  }
}
