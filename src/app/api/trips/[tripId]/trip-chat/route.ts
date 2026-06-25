import { NextResponse } from "next/server";
import { z } from "zod";

import { proposeTripCommands } from "@/lib/ai/propose-trip-commands";
import { parseClientActivities } from "@/lib/ai/client-activities-payload";
import { friendlyTripChatFailure } from "@/lib/ai/trip-chat-fallback";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { enforceAiBuilder } from "@/lib/plans/enforce-plan";
import { loadTripGraph } from "@/lib/trip-engine";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  groupId: z.string().uuid().optional(),
  clientActivities: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
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
      return NextResponse.json(friendlyTripChatFailure(new Error(aiCheck.hardBlock)));
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        friendlyTripChatFailure(new Error("Invalid request.")),
      );
    }

    const graph = await loadTripGraph(tripId);
    if (!graph) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const groupId = parsed.data.groupId ?? graph.mainGroupId;

    const result = await proposeTripCommands({
      messages: parsed.data.messages,
      graph,
      groupId,
      clientActivities: parseClientActivities(parsed.data.clientActivities),
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(friendlyTripChatFailure(err));
  }
}
