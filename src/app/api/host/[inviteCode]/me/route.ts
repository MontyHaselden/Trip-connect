import { NextResponse } from "next/server";

import { requireHostTripForInvite } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;

  try {
    const membership = await requireHostTripForInvite(inviteCode);
    return NextResponse.json({
      tripId: membership.id,
      inviteCode: membership.inviteCode,
      publishedVersion: membership.publishedVersion,
      canEdit: membership.canEdit,
      role: membership.role,
      hostId: membership.hostId,
      isHostMember: true,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}
