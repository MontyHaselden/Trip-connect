import { NextResponse } from "next/server";

import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import {
  loadPhraseTree,
  seedDefaultPhrasesIfEmpty,
} from "@/lib/host/phrases-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const result = await seedDefaultPhrasesIfEmpty(trip.id);
    if (!result.created) {
      return NextResponse.json(
        { error: result.message ?? "Categories already exist." },
        { status: 400 },
      );
    }
    const tree = await loadPhraseTree(trip.id);
    await maybeAutoPublish(trip.id);
    return NextResponse.json(tree);
  } catch (err) {
    return hostApiError(err);
  }
}
