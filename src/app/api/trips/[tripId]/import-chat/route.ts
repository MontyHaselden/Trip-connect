import { NextResponse } from "next/server";
import { z } from "zod";

import { assessImportReadiness } from "@/lib/ai/assess-import-readiness";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { extractTextFromUpload } from "@/lib/documents/extract-text";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { enforceAiBuilder } from "@/lib/plans/enforce-plan";

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
      return NextResponse.json({ error: aiCheck.hardBlock }, { status: 403 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const messagesRaw = form.get("messages");
    if (typeof messagesRaw !== "string") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let messagesJson: unknown;
    try {
      messagesJson = JSON.parse(messagesRaw);
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const parsed = BodySchema.safeParse({
      messages: messagesJson,
      pastedText:
        typeof form.get("pastedText") === "string"
          ? String(form.get("pastedText"))
          : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const file = form.get("file");
    let fileText = "";
    if (file instanceof File && file.size > 0) {
      try {
        fileText = await extractTextFromUpload(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not read document.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const documentText = [parsed.data.pastedText?.trim(), fileText.trim()]
      .filter(Boolean)
      .join("\n\n");

    if (!documentText && parsed.data.messages.length === 0) {
      return NextResponse.json(
        { error: "Paste an itinerary or attach a document to start." },
        { status: 400 },
      );
    }

    const result = await assessImportReadiness({
      documentText,
      messages: parsed.data.messages,
      defaultTimezone: trip.timezone,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Chat failed.";
    if (msg.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return hostApiError(err);
  }
}
