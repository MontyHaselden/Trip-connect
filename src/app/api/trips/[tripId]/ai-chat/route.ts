import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { processMockChatMessage } from "@/lib/ai/mock-chat";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { loadItineraryTree } from "@/lib/host/itinerary-queries";
import { aiChangeProposals } from "@/lib/db/schema";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const itinerary = await loadItineraryTree(tripId);
    const result = processMockChatMessage({
      message: parsed.data.message,
      itinerary,
    });

    const [proposal] = await db
      .insert(aiChangeProposals)
      .values({
        tripId,
        createdBy: hostId,
        userMessage: parsed.data.message,
        assistantReply: result.assistantReply,
        proposedChangesJson: result.proposedChanges,
        warningsJson: result.warnings,
        status: result.needsClarification ? "draft" : "draft",
      })
      .returning();

    return NextResponse.json({
      proposalId: proposal?.id,
      assistantReply: result.assistantReply,
      needsClarification: result.needsClarification,
      proposedChanges: result.proposedChanges,
      warnings: result.warnings,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
