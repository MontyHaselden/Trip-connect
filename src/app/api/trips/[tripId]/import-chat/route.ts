import { NextResponse } from "next/server";
import { z } from "zod";

import { assessImportReadiness } from "@/lib/ai/assess-import-readiness";
import { proposeTripCommands } from "@/lib/ai/propose-trip-commands";
import { friendlyImportChatFailure } from "@/lib/ai/trip-chat-fallback";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { extractTextFromUpload } from "@/lib/documents/extract-text";
import { isImageUploadFile, isItineraryDocumentFile } from "@/lib/documents/is-image-upload";
import {
  loadAssistantChatSession,
  saveAssistantChatSession,
} from "@/lib/host/assistant-chat/persistence";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { enforceAiBuilder } from "@/lib/plans/enforce-plan";
import { calendarHasPaint } from "@/lib/trip-engine/calendar-has-paint";
import { loadTripGraph } from "@/lib/trip-engine";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(8000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).max(40),
  pastedText: z.string().max(50_000).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const aiCheck = await enforceAiBuilder(hostId);
    if (!aiCheck.allowed) {
      return NextResponse.json(friendlyImportChatFailure(new Error(aiCheck.hardBlock)));
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json(friendlyImportChatFailure(new Error("Invalid request.")));
    }

    const messagesRaw = form.get("messages");
    if (typeof messagesRaw !== "string") {
      return NextResponse.json(friendlyImportChatFailure(new Error("Invalid request.")));
    }

    let messagesJson: unknown;
    try {
      messagesJson = JSON.parse(messagesRaw);
    } catch {
      return NextResponse.json(friendlyImportChatFailure(new Error("Invalid request.")));
    }

    const parsed = BodySchema.safeParse({
      messages: messagesJson,
      pastedText:
        typeof form.get("pastedText") === "string"
          ? String(form.get("pastedText"))
          : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(friendlyImportChatFailure(new Error("Invalid request.")));
    }

    const file = form.get("file");
    let fileText = "";
    let attachedFileName: string | null = null;
    const graph = await loadTripGraph(tripId);
    const groupId = graph?.mainGroupId ?? "";
    const builtCalendar = graph ? calendarHasPaint(graph, groupId) : false;

    if (file instanceof File && file.size > 0) {
      attachedFileName = file.name;
      if (isImageUploadFile(file)) {
        if (builtCalendar && graph) {
          const tripResult = await proposeTripCommands({
            messages: parsed.data.messages,
            graph,
            groupId,
          });
          return NextResponse.json({
            status: "needs_clarification",
            assistantReply: tripResult.assistantReply,
            importInstructions: null,
            proposedCommands: tripResult.proposedCommands,
            commandSummaries: tripResult.commandSummaries,
            warnings: tripResult.warnings,
          });
        }
        return NextResponse.json({
          status: "needs_clarification",
          assistantReply:
            "I can't read screenshots as itineraries. Attach a PDF or paste text to import, or once the calendar is built tell me what to change in words (e.g. \"clear everything\" or \"fill the Tokyo gap\").",
          importInstructions: null,
        });
      }
      if (!isItineraryDocumentFile(file)) {
        return NextResponse.json(friendlyImportChatFailure(new Error("Unsupported file type.")));
      }
      try {
        fileText = await extractTextFromUpload(file);
      } catch (err) {
        if (builtCalendar && graph) {
          const tripResult = await proposeTripCommands({
            messages: parsed.data.messages,
            graph,
            groupId,
          });
          return NextResponse.json({
            status: "needs_clarification",
            assistantReply: tripResult.assistantReply,
            importInstructions: null,
            proposedCommands: tripResult.proposedCommands,
            commandSummaries: tripResult.commandSummaries,
            warnings: tripResult.warnings,
          });
        }
        return NextResponse.json(friendlyImportChatFailure(err));
      }
    }

    const session = await loadAssistantChatSession(tripId);
    const sessionSource = session?.sourceText?.trim() ?? "";
    const pasted = parsed.data.pastedText?.trim() ?? "";

    const documentText = [sessionSource, pasted, fileText.trim()]
      .filter(Boolean)
      .join("\n\n");

    if (!documentText && parsed.data.messages.length === 0) {
      return NextResponse.json({
        status: "needs_clarification",
        assistantReply:
          "Paste your itinerary here or attach a PDF — include the month and year if you can.",
        importInstructions: null,
      });
    }

    const isNewUpload = file instanceof File && file.size > 0;
    const isNewDocumentUpload =
      isNewUpload && file instanceof File && isItineraryDocumentFile(file);
    const pastedLines = pasted.split("\n").filter((line) => line.trim().length > 0);
    const isLargeItineraryPaste = pasted.length > 400 || pastedLines.length >= 4;

    if (
      graph &&
      builtCalendar &&
      !isNewDocumentUpload &&
      !isLargeItineraryPaste
    ) {
      const tripResult = await proposeTripCommands({
        messages: parsed.data.messages,
        graph,
        groupId: graph.mainGroupId,
      });
      return NextResponse.json({
        status: "needs_clarification",
        assistantReply: tripResult.assistantReply,
        importInstructions: null,
        proposedCommands: tripResult.proposedCommands,
        commandSummaries: tripResult.commandSummaries,
        warnings: tripResult.warnings,
      });
    }

    let persistedSourceText = documentText;
    if (fileText.trim() || (pasted && pasted !== sessionSource)) {
      persistedSourceText = [sessionSource, pasted, fileText.trim()]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 50_000);
      await saveAssistantChatSession(tripId, {
        messages: session?.messages ?? [],
        sourceText: persistedSourceText,
      });
    }

    try {
      const result = await assessImportReadiness({
        documentText,
        messages: parsed.data.messages,
        defaultTimezone: trip.timezone,
      });

      return NextResponse.json({
        ...result,
        sourceText: persistedSourceText,
        attachedFileName,
      });
    } catch (err) {
      return NextResponse.json(friendlyImportChatFailure(err));
    }
  } catch (err) {
    return NextResponse.json(friendlyImportChatFailure(err));
  }
}
