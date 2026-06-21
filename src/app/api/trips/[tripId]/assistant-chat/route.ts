import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import {
  clearAssistantChatSession,
  loadAssistantChatSession,
  saveAssistantChatSession,
} from "@/lib/host/assistant-chat/persistence";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

const MessageSchema = z.object({
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

const PutBodySchema = z.object({
  messages: z.array(MessageSchema).max(80),
  sourceText: z.string().max(50_000).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const session = await loadAssistantChatSession(tripId);
    return NextResponse.json({
      messages: session?.messages ?? [],
      sourceText: session?.sourceText ?? "",
    });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PutBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    await saveAssistantChatSession(tripId, {
      messages: parsed.data.messages,
      sourceText: parsed.data.sourceText ?? "",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    await clearAssistantChatSession(tripId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
