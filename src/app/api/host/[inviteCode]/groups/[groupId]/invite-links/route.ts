import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { groupInviteLinks, groups, participants } from "@/lib/db/schema";
import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { generateInviteCode } from "@/lib/utils/tokens";

const CreateLinkSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string; groupId: string }> },
) {
  const { inviteCode, groupId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const group = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.tripId, trip.id)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const links = await db
      .select({
        id: groupInviteLinks.id,
        inviteCode: groupInviteLinks.inviteCode,
        label: groupInviteLinks.label,
        isActive: groupInviteLinks.isActive,
        createdAt: groupInviteLinks.createdAt,
      })
      .from(groupInviteLinks)
      .where(
        and(eq(groupInviteLinks.tripId, trip.id), eq(groupInviteLinks.groupId, groupId)),
      );

    const joinCounts = await Promise.all(
      links.map(async (link) => {
        const count = await db
          .select({ id: participants.id })
          .from(participants)
          .where(eq(participants.joinedViaGroupInviteLinkId, link.id));
        return { linkId: link.id, joinCount: count.length };
      }),
    );
    const countById = new Map(joinCounts.map((c) => [c.linkId, c.joinCount]));

    return NextResponse.json({
      links: links.map((link) => ({
        ...link,
        joinCount: countById.get(link.id) ?? 0,
      })),
    });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string; groupId: string }> },
) {
  const { inviteCode, groupId } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const group = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, groupId), eq(groups.tripId, trip.id)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const json = await req.json().catch(() => null);
    const parsed = CreateLinkSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const code = generateInviteCode();
    const [created] = await db
      .insert(groupInviteLinks)
      .values({
        tripId: trip.id,
        groupId,
        inviteCode: code,
        label: parsed.data.label,
      })
      .returning();

    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}
