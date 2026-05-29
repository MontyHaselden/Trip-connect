import { NextResponse } from "next/server";

import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;

  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const result = await maybeAutoPublish(trip.id);
    if (!result) {
      return NextResponse.json({
        ok: true,
        message: "Already up to date.",
        version: trip.publishedVersion,
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    return hostApiError(err);
  }
}
