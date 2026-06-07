import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { processChatMessage } from "@/lib/ai/process-chat-message";
import { ChangeScopeSchema } from "@/lib/ai/change-scope-schema";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { loadItineraryTree } from "@/lib/host/itinerary-queries";
import { aiChangeProposals, aiUsageEvents } from "@/lib/db/schema";
import { enforceAiBuilder } from "@/lib/plans/enforce-plan";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  changeScope: ChangeScopeSchema,
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

    const aiCheck = await enforceAiBuilder(hostId);
    if (!aiCheck.allowed) {
      return NextResponse.json({ error: aiCheck.hardBlock }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const itinerary = await loadItineraryTree(tripId);
    const result = await processChatMessage({
      message: parsed.data.message,
      itinerary,
      changeScope: parsed.data.changeScope,
      trip: {
        name: trip.name,
        startDate: trip.startDate,
        endDate: trip.endDate,
        timezone: trip.timezone,
        destinationCountry: trip.destinationCountry,
        destinationLanguage: trip.destinationLanguage,
      },
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

    await db.insert(aiUsageEvents).values({
      accountId: hostId,
      tripId,
      eventType: "chat",
      callCount: 1,
      estimatedCostCents: 5,
    });

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
