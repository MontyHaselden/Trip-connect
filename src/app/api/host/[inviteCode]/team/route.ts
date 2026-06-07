import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  requireHostTripEditAccess,
  requireHostTripForInvite,
} from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { db } from "@/lib/db/client";
import { hostAccounts, hostTripInvites, hostTripMembers } from "@/lib/db/schema";
import { getStaffCountForAccount } from "@/lib/plans/account-usage";
import { enforceStaffLimit } from "@/lib/plans/enforce-plan";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripForInvite(inviteCode);

    const members = await db
      .select({
        hostId: hostTripMembers.hostId,
        canEdit: hostTripMembers.canEdit,
        acceptedAt: hostTripMembers.acceptedAt,
        email: hostAccounts.email,
        fullName: hostAccounts.fullName,
        role: hostAccounts.role,
      })
      .from(hostTripMembers)
      .innerJoin(hostAccounts, eq(hostAccounts.id, hostTripMembers.hostId))
      .where(eq(hostTripMembers.tripId, trip.id));

    const pending = await db
      .select({
        id: hostTripInvites.id,
        invitedEmail: hostTripInvites.invitedEmail,
        canEdit: hostTripInvites.canEdit,
        invitedAt: hostTripInvites.invitedAt,
      })
      .from(hostTripInvites)
      .where(eq(hostTripInvites.tripId, trip.id));

    return NextResponse.json({ members, pending });
  } catch (err) {
    return hostApiError(err);
  }
}

const InviteSchema = z.object({
  email: z.string().trim().email().max(200),
  canEdit: z.boolean().default(true),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const membership = await requireHostTripEditAccess(inviteCode);

    const staffCount = await getStaffCountForAccount(membership.hostId);
    const staffCheck = await enforceStaffLimit({
      accountId: membership.hostId,
      staffCount: staffCount + 1,
    });
    if (!staffCheck.allowed) {
      return NextResponse.json({ error: staffCheck.hardBlock ?? staffCheck.softWarning }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = InviteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const host = await db
      .select({ id: hostAccounts.id })
      .from(hostAccounts)
      .where(sql`lower(${hostAccounts.email}) = ${email}`)
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (host) {
      const exists = await db
        .select({ hostId: hostTripMembers.hostId })
        .from(hostTripMembers)
        .where(
          sql`${hostTripMembers.tripId} = ${membership.id} AND ${hostTripMembers.hostId} = ${host.id}`,
        )
        .limit(1)
        .then((rows) => rows[0] ?? null);

      if (!exists) {
        await db.insert(hostTripMembers).values({
          hostId: host.id,
          tripId: membership.id,
          canEdit: parsed.data.canEdit,
          acceptedAt: new Date(),
        });
      }
    } else {
      await db
        .insert(hostTripInvites)
        .values({
          tripId: membership.id,
          invitedEmail: email,
          canEdit: parsed.data.canEdit,
          invitedByHostId: membership.hostId,
        })
        .onConflictDoUpdate({
          target: [hostTripInvites.tripId, hostTripInvites.invitedEmail],
          set: {
            canEdit: parsed.data.canEdit,
            invitedAt: new Date(),
          },
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
